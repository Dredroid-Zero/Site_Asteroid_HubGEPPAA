import pandas as pd
from flask import Flask, render_template, request, session, redirect, url_for, flash, jsonify
from flask_session import Session
import os

from services import run_full_search_logic, ALL_COLUMNS, DEFAULT_COLUMNS

app = Flask(__name__)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

def initialize_session():
    if 'saved_tables' not in session: session['saved_tables'] = {'Tabela Padrão': []}
    if 'active_table' not in session: session['active_table'] = 'Tabela Padrão'
    if 'visible_columns' not in session: session['visible_columns'] = list(DEFAULT_COLUMNS)
    if 'column_order' not in session: session['column_order'] = [col for col in ALL_COLUMNS if col in DEFAULT_COLUMNS]

@app.before_request
def before_request_func():
    initialize_session()

@app.route("/")
def index():
    session.pop('last_search_results', None); session.pop('previous_input', None)
    return render_template('index.html')

@app.route("/run-search", methods=['POST'])
def run_search():
    session['previous_input'] = request.form.get('identificadores', '').strip()
    prelim_list = [code.strip() for code in session['previous_input'].splitlines() if code.strip()]
    if not prelim_list: flash("Por favor, insira pelo menos um identificador.", "warning"); return redirect(url_for('index'))
    full_df = run_full_search_logic(prelim_list)
    if full_df is None or full_df.empty: flash("Nenhum dado válido foi encontrado.", "danger"); return redirect(url_for('index'))
    session['last_search_results'] = full_df.to_dict('records'); return redirect(url_for('mostrar_resultados'))

@app.route("/resultados")
def mostrar_resultados():
    search_results = session.get('last_search_results');
    if not search_results: return redirect(url_for('index'))
    visible_cols = [col for col in session['column_order'] if col in search_results[0] and col in session['visible_columns']]
    return render_template('index.html', search_results=search_results, visible_cols=visible_cols, saved_tables_names=list(session['saved_tables'].keys()))

@app.route("/minhas-tabelas")
def minhas_tabelas():
    active_table_name = request.args.get('active_table', session.get('active_table'))
    session['active_table'] = active_table_name
    table_data = session['saved_tables'].get(active_table_name, [])
    visible_cols = []
    if table_data:
        all_columns_in_data = table_data[0].keys()
        visible_cols = [col for col in session['column_order'] if col in all_columns_in_data and col in session['visible_columns']]
        if not visible_cols and 'Objeto' in all_columns_in_data:
            visible_cols = ['Objeto']
    return render_template('minha_tabela.html', active_table_name=active_table_name, saved_tables_names=list(session['saved_tables'].keys()), table_data=table_data, table_headers=visible_cols)

@app.route("/configuracoes", methods=["GET", "POST"])
def configuracoes():
    if request.method == "POST":
        visible_columns = request.form.getlist('visible_columns'); received_order = [line.strip() for line in request.form.get('column_order', '').strip().splitlines() if line.strip()]
        final_order = [col for col in received_order if col in visible_columns]
        session['visible_columns'] = visible_columns; session['column_order'] = final_order
        flash('Configurações salvas com sucesso!', 'success'); return redirect(url_for('configuracoes'))
    visible_columns_list = session.get('visible_columns'); column_order_list = session.get('column_order')
    if not column_order_list: column_order_list = [col for col in ALL_COLUMNS if col in visible_columns_list]
    return render_template('configuracoes.html', ALL_COLUMNS=ALL_COLUMNS, DEFAULT_COLUMNS=list(DEFAULT_COLUMNS), visible_columns=visible_columns_list, column_order=column_order_list)

@app.route("/add-rows-batch", methods=["POST"])
def add_rows_batch():
    tabela_destino = request.form.get('tabela_destino'); objects_to_add_str = request.form.get('objects_to_add', '')
    objects_to_add = {name.strip() for name in objects_to_add_str.split(',') if name.strip()}; search_results = session.get('last_search_results', [])
    if tabela_destino and objects_to_add and search_results:
        rows_to_add = [row for row in search_results if row['Objeto'] in objects_to_add]; saved_tables = session.get('saved_tables', {})
        table_list = saved_tables.get(tabela_destino, []); existing_objects = {d['Objeto'] for d in table_list}; novos_objetos_count = 0
        for new_row in rows_to_add:
            if new_row['Objeto'] not in existing_objects: table_list.append(new_row); novos_objetos_count += 1
        saved_tables[tabela_destino] = table_list; session['saved_tables'] = saved_tables; session.modified = True
        flash(f"{novos_objetos_count} objeto(s) novo(s) salvo(s) com sucesso em '{tabela_destino}'.", 'success')
    return redirect(url_for('mostrar_resultados'))

@app.route('/reorder-rows', methods=['POST'])
def reorder_rows():
    data = request.get_json(); active_table_name = session.get('active_table'); new_order = data.get('new_order')
    if not active_table_name or not new_order: return jsonify({'success': False, 'message': 'Dados inválidos.'}), 400
    table_list = session['saved_tables'].get(active_table_name, []); row_map = {str(row['Objeto']): row for row in table_list}
    reordered_list = [row_map[obj_name] for obj_name in new_order if obj_name in row_map]; reordered_set = set(new_order)
    for row in table_list:
        if str(row['Objeto']) not in reordered_set: reordered_list.append(row)
    saved_tables = session['saved_tables']; saved_tables[active_table_name] = reordered_list; session.modified = True
    return jsonify({'success': True, 'message': 'Ordem salva com sucesso!'})

@app.route("/create-table", methods=["POST"])
def create_table():
    new_name = request.form.get('new_name', '').strip()
    if new_name and new_name not in session['saved_tables']:
        saved_tables = session['saved_tables']; saved_tables[new_name] = []; session['saved_tables'] = saved_tables; session.modified = True; session['active_table'] = new_name
        flash(f"Tabela '{new_name}' criada com sucesso!", "success")
    elif new_name in session['saved_tables']: flash(f"Erro: A tabela '{new_name}' já existe.", "danger")
    return redirect(url_for('minhas_tabelas'))

@app.route("/rename-table", methods=["POST"])
def rename_table():
    old_name = session.get('active_table'); new_name = request.form.get('new_name', '').strip()
    if old_name and new_name and new_name not in session['saved_tables']:
        saved_tables = session['saved_tables']; saved_tables[new_name] = saved_tables.pop(old_name, []); session['saved_tables'] = saved_tables; session.modified = True; session['active_table'] = new_name
        flash(f"Tabela '{old_name}' renomeada para '{new_name}'.", "success")
    elif new_name in session['saved_tables']: flash(f"Erro: O nome '{new_name}' já está em uso.", "danger")
    return redirect(url_for('minhas_tabelas', active_table=new_name))

@app.route("/delete-table", methods=["POST"])
def delete_table():
    table_to_delete = session.get('active_table')
    if table_to_delete and table_to_delete in session['saved_tables']:
        if len(session['saved_tables']) <= 1: flash("Não é possível excluir a última tabela.", "warning"); return redirect(url_for('minhas_tabelas'))
        saved_tables = session['saved_tables']; saved_tables.pop(table_to_delete); session['saved_tables'] = saved_tables; session.modified = True; session['active_table'] = list(session['saved_tables'].keys())[0]
        flash(f"Tabela '{table_to_delete}' excluída com sucesso.", "success")
    return redirect(url_for('minhas_tabelas'))

@app.route('/delete-rows', methods=['POST'])
def delete_rows():
    active_table_name = session.get('active_table'); table_list = session['saved_tables'].get(active_table_name, [])
    rows_to_delete_str = request.form.get('rows_to_delete', ''); rows_to_delete = {name.strip() for name in rows_to_delete_str.split(',') if name.strip()}
    if rows_to_delete and table_list:
        original_count = len(table_list); updated_table_list = [row for row in table_list if row['Objeto'] not in rows_to_delete]
        saved_tables = session['saved_tables']; saved_tables[active_table_name] = updated_table_list; session['saved_tables'] = saved_tables; session.modified = True
        deleted_count = original_count - len(updated_table_list)
        flash(f'{deleted_count} linha(s) foram excluídas da tabela "{active_table_name}".', 'success')
    return redirect(url_for('minhas_tabelas'))

@app.route("/reanalisar", methods=["POST"])
def reanalyze():
    active_table_name = session.get('active_table'); table_list = session['saved_tables'].get(active_table_name, [])
    if not table_list: flash("Tabela vazia, nada para reanalisar.", "info"); return redirect(url_for('minhas_tabelas'))
    old_df = pd.DataFrame(table_list); objetos_para_reanalise = old_df['Objeto'].tolist()
    new_df = run_full_search_logic(objetos_para_reanalise)
    if new_df is not None and not new_df.empty:
        saved_tables = session['saved_tables']; saved_tables[active_table_name] = new_df.to_dict('records'); session['saved_tables'] = saved_tables; session.modified = True
        flash("Tabela reanalisada com sucesso!", "success")
    else: flash("Não foi possível obter novos dados na reanálise.", "warning")
    return redirect(url_for('minhas_tabelas'))

if __name__ == '__main__':
    app.run(debug=True)