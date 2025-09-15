import pandas as pd
import requests
from requests.exceptions import RequestException
from bs4 import BeautifulSoup
import time
from flask import Flask, render_template, request, session, redirect, url_for, flash
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

# --- Constantes de Configuração ---
ALL_COLUMNS = [
    'Objeto', 'Status do objeto', 'Designação IAU', 'String da Observação', '(*?)',
    'Linhas de Observação WAMO', 'Status de Consulta', 'Tipo de Órbita',
    'Magnitude Absoluta', 'Incerteza', 'Referência', 'Observações Utilizadas',
    'Oposições', 'Comprimento do Arco (dias)', 'Primeira Oposição Usada',
    'Última Oposição Usada', 'Primeira Data de Obs. Usada',
    'Última Data de Obs. Usada', 'Descrição'
]
DEFAULT_COLUMNS = {'Objeto', 'Status do objeto', 'Designação IAU', '(*?)', 'Magnitude Absoluta', 'Tipo de Órbita', 'Descrição'}


# --- Funções de Lógica ---
def get_mpc_raw_data(desig: str):
    if not desig or desig == "-": return "⚠️ A designação do objeto está vazia."
    clean_desig = desig.strip().replace(" ", "+").replace("(", "%28").replace(")", "%29")
    url = f"https://minorplanetcenter.net/db_search/show_object?object_id={clean_desig}"
    try:
        response = requests.get(url, timeout=10); response.raise_for_status(); return response.text
    except RequestException: return f"❌ Erro: Objeto '{desig}' não encontrado."
    except Exception as e: return f"❌ Erro inesperado: {e}"

def extract_orbital_data_from_html(html_content: str):
    soup = BeautifulSoup(html_content, 'html.parser'); data = {}
    try:
        first_obs_p = soup.find(string=lambda s: "Initial reported observation" in s or "Discovered" in s)
        data['Descrição'] = first_obs_p.strip() if first_obs_p else None
        orbit_type_p = soup.find(string=lambda s: "Orbit type:" in s)
        data['Tipo de Órbita'] = orbit_type_p.split(':')[-1].strip() if orbit_type_p else None
    except Exception: pass
    orbit_tables = soup.find_all('table', class_='nb')
    for table in orbit_tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True).replace('(°)', '').replace('(AU)', ''); value = cells[1].get_text(strip=True)
                mapa_labels = {'absolute magnitude': 'Magnitude Absoluta', 'uncertainty': 'Incerteza', 'reference': 'Referência', 'observations used': 'Observações Utilizadas', 'oppositions': 'Oposições', 'arc length (days)': 'Comprimento do Arco (dias)', 'first opposition used': 'Primeira Oposição Usada', 'last opposition used': 'Última Oposição Usada', 'first observation date used': 'Primeira Data de Obs. Usada', 'last observation date used': 'Última Data de Obs. Usada'}
                if label in mapa_labels: data[mapa_labels[label]] = value
    return data

def get_object_status(row):
    status_consulta = str(row.get('Status de Consulta', '')); designacao_iau = str(row.get('Designação IAU', '')); objeto = str(row.get('Objeto', ''))
    if status_consulta != 'Publicado': return 'Preliminar'
    else:
        if designacao_iau.isdigit(): return 'FNumerado' if objeto.startswith('IU') else 'Numerado'
        else: return 'FProvisório' if objeto.startswith('IU') else 'Provisório'

def run_full_search_logic(prelim_list):
    all_combined_data = []
    CHUNK_SIZE = 25
    for i in range(0, len(prelim_list), CHUNK_SIZE):
        chunk = prelim_list[i:i + CHUNK_SIZE]
        final_search_list, prelim_to_final_map = [], {}
        for code in chunk:
            if code.startswith('P1'): final_id = f"{code} F51"; final_search_list.append(final_id); prelim_to_final_map[final_id] = code
            elif code.startswith('P2'): final_id = f"{code} F52"; final_search_list.append(final_id); prelim_to_final_map[final_id] = code
            else:
                final_id_f51, final_id_f52 = f"{code} F51", f"{code} F52"; final_search_list.extend([final_id_f51, final_id_f52]); prelim_to_final_map[final_id_f51] = code; prelim_to_final_map[final_id_f52] = code
        try:
            response = requests.get("https://data.minorplanetcenter.net/api/wamo", json=final_search_list)
            response.raise_for_status(); wamo_found_data = response.json().get('found', [])
        except RequestException: continue
        if not wamo_found_data: continue
        for found_item in wamo_found_data:
            for identifier, obs_list_for_id in found_item.items():
                if not obs_list_for_id: continue
                selected_obs = obs_list_for_id[0]
                decoded_status = str(selected_obs.get('status_decoded', '')).lower()
                if 'published' in decoded_status: status_consulta = 'Publicado'
                elif 'candidate for duplicate' in decoded_status: status_consulta = 'Quase Duplicado'
                else: status_consulta = "N/A"
                wamo_info = {'Objeto': prelim_to_final_map.get(identifier, 'N/A'), 'Designação IAU': selected_obs.get('iau_desig', 'Não Encontrado'), 'String da Observação': selected_obs.get('obs80', '').split(maxsplit=1)[0], 'Linhas de Observação WAMO': len(obs_list_for_id), 'Status de Consulta': status_consulta}
                orbital_info = {}
                iau_desig = wamo_info['Designação IAU']
                if iau_desig and iau_desig != 'Não Encontrado':
                    raw_data_mpc = get_mpc_raw_data(iau_desig)
                    if not (raw_data_mpc.startswith('❌') or raw_data_mpc.startswith('⚠️')): orbital_info = extract_orbital_data_from_html(raw_data_mpc)
                all_combined_data.append({**wamo_info, **orbital_info})
            time.sleep(0.5)
    
    if not all_combined_data: return None
    df = pd.DataFrame(all_combined_data)
    df['Status do objeto'] = df.apply(get_object_status, axis=1)
    df['(*?)'] = df['String da Observação'].apply(lambda x: 'SIM' if '*' in str(x) else 'NÃO')
    df.fillna('-', inplace=True)
    return df

def initialize_session():
    if 'saved_tables' not in session:
        session['saved_tables'] = {'Tabela Padrão': []}
    if 'active_table' not in session:
        session['active_table'] = 'Tabela Padrão'
    if 'visible_columns' not in session:
        session['visible_columns'] = list(DEFAULT_COLUMNS)
    if 'column_order' not in session:
        session['column_order'] = [col for col in ALL_COLUMNS if col in DEFAULT_COLUMNS]

@app.before_request
def before_request_func():
    initialize_session()

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/run-search", methods=["POST"])
def run_search():
    session['previous_input'] = request.form.get('identificadores', '').strip()
    session.pop('notification', None) # Limpa notificações antigas
    prelim_list = [code.strip() for code in session['previous_input'].splitlines() if code.strip()]
    if not prelim_list:
        return render_template('index.html', error="Por favor, insira identificadores.")

    full_df = run_full_search_logic(prelim_list)
    if full_df is None:
        return render_template('index.html', error="Nenhum dado válido foi encontrado.")
    
    session['last_search_results'] = full_df.to_dict('records')
    
    visible_cols = [col for col in session['column_order'] if col in session['visible_columns']]
    
    return render_template('index.html', 
                           search_results=session['last_search_results'],
                           visible_cols=visible_cols,
                           saved_tables_names=list(session['saved_tables'].keys()))

@app.route("/configuracoes", methods=["GET", "POST"])
def configuracoes():
    if request.method == "POST":
        visible_columns = request.form.getlist('visible_columns')
        received_order = [line.strip() for line in request.form.get('column_order', '').strip().splitlines() if line.strip()]
        final_order = [col for col in received_order if col in visible_columns]
        session['visible_columns'] = visible_columns
        session['column_order'] = final_order
        flash('Configurações salvas com sucesso!', 'success')
        return redirect(url_for('configuracoes'))

    visible_columns_list = session.get('visible_columns')
    column_order_list = session.get('column_order')
    if not column_order_list:
        column_order_list = [col for col in ALL_COLUMNS if col in visible_columns_list]

    return render_template('configuracoes.html', 
                           ALL_COLUMNS=ALL_COLUMNS, 
                           visible_columns=visible_columns_list,
                           column_order=column_order_list)

@app.route("/add-rows-batch", methods=["POST"])
def add_rows_batch():
    tabela_destino = request.form.get('tabela_destino')
    objects_to_add_str = request.form.get('objects_to_add', '')
    objects_to_add = {name.strip() for name in objects_to_add_str.split(',') if name.strip()}
    search_results = session.get('last_search_results', [])
    
    if tabela_destino and objects_to_add and search_results:
        rows_to_add = [row for row in search_results if row['Objeto'] in objects_to_add]
        
        saved_tables = session.get('saved_tables', {})
        table_list = saved_tables.get(tabela_destino, [])
        existing_objects = {d['Objeto'] for d in table_list}
        
        novos_objetos_count = 0
        objetos_atualizados_count = 0
        
        for new_row in rows_to_add:
            obj_name = new_row['Objeto']
            if obj_name not in existing_objects:
                table_list.append(new_row)
                novos_objetos_count += 1
            else:
                for i, existing_row in enumerate(table_list):
                    if existing_row['Objeto'] == obj_name:
                        table_list[i] = new_row
                        objetos_atualizados_count += 1
                        break
        
        saved_tables[tabela_destino] = table_list
        session['saved_tables'] = saved_tables
        session['notification'] = f"{novos_objetos_count + objetos_atualizados_count} objeto(s) salvo(s) em '{tabela_destino}'."

    # Após salvar, recarrega a página de busca para mostrar a notificação e manter o contexto
    visible_cols = [col for col in session['column_order'] if col in session.get('last_search_results', [{}])[0].keys() and col in session['visible_columns']]
    return render_template('index.html', 
                           search_results=session.get('last_search_results'),
                           visible_cols=visible_cols,
                           saved_tables_names=list(session['saved_tables'].keys()),
                           notification=session.get('notification'))


@app.route("/minhas-tabelas")
def minhas_tabelas():
    active_table_name = request.args.get('active_table', session.get('active_table'))
    session['active_table'] = active_table_name

    minha_tabela_list = session['saved_tables'].get(active_table_name, [])
    
    df = pd.DataFrame(minha_tabela_list)
    table_html = None
    if not df.empty:
        visible_cols = [col for col in session['column_order'] if col in df.columns and col in session['visible_columns']]
        df_display = df[visible_cols]
        table_html = df_display.to_html(classes="table table-striped table-hover", index=False, border=0)

    return render_template('minha_tabela.html', 
                           table_html=f'<div class="table-container">{table_html}</div>' if table_html else None, 
                           active_table_name=active_table_name,
                           saved_tables_names=list(session['saved_tables'].keys()),
                           table_data=minha_tabela_list)

@app.route("/create-table", methods=["POST"])
def create_table():
    new_name = request.form.get('new_name', '').strip()
    if new_name and new_name not in session['saved_tables']:
        saved_tables = session['saved_tables']
        saved_tables[new_name] = []
        session['saved_tables'] = saved_tables
        session['active_table'] = new_name
        flash(f"Tabela '{new_name}' criada com sucesso!", "success")
    elif new_name in session['saved_tables']:
        flash(f"Erro: A tabela '{new_name}' já existe.", "danger")
    return redirect(url_for('minhas_tabelas'))

@app.route("/rename-table", methods=["POST"])
def rename_table():
    old_name = session.get('active_table')
    new_name = request.form.get('new_name', '').strip()
    if old_name and new_name and new_name not in session['saved_tables']:
        saved_tables = session['saved_tables']
        saved_tables[new_name] = saved_tables.pop(old_name, [])
        session['saved_tables'] = saved_tables
        session['active_table'] = new_name
        flash(f"Tabela '{old_name}' renomeada para '{new_name}'.", "success")
    elif new_name in session['saved_tables']:
        flash(f"Erro: O nome '{new_name}' já está em uso.", "danger")
    return redirect(url_for('minhas_tabelas'))
    
@app.route("/delete-table", methods=["POST"])
def delete_table():
    table_to_delete = session.get('active_table')
    if table_to_delete and table_to_delete in session['saved_tables']:
        if len(session['saved_tables']) <= 1:
            flash("Não é possível excluir a última tabela.", "warning")
            return redirect(url_for('minhas_tabelas'))
            
        saved_tables = session['saved_tables']
        saved_tables.pop(table_to_delete)
        session['saved_tables'] = saved_tables
        session['active_table'] = list(session['saved_tables'].keys())[0]
        flash(f"Tabela '{table_to_delete}' excluída com sucesso.", "success")
    return redirect(url_for('minhas_tabelas'))

@app.route("/delete-rows", methods=["POST"])
def delete_rows():
    active_table_name = session.get('active_table')
    objects_to_remove_str = request.form.get('objects_to_delete', '')
    objects_to_remove = {name.strip() for name in objects_to_remove_str.split(',') if name.strip()}
    
    if active_table_name and objects_to_remove:
        saved_tables = session['saved_tables']
        table_list = saved_tables.get(active_table_name, [])
        new_table_list = [row for row in table_list if row['Objeto'] not in objects_to_remove]
        saved_tables[active_table_name] = new_table_list
        session['saved_tables'] = saved_tables
        flash(f"{len(objects_to_remove)} linha(s) excluída(s) da tabela '{active_table_name}'.", "success")
        
    return redirect(url_for('minhas_tabelas'))

@app.route("/reorder-rows", methods=["POST"])
def reorder_rows():
    active_table_name = session.get('active_table')
    ordered_objects_str = request.form.get('ordered_objects', '')
    ordered_objects = [name.strip() for name in ordered_objects_str.split(',') if name.strip()]

    if active_table_name and ordered_objects:
        saved_tables = session['saved_tables']
        table_list = saved_tables.get(active_table_name, [])
        
        table_dict = {row['Objeto']: row for row in table_list}
        
        new_table_list = [table_dict[obj_name] for obj_name in ordered_objects if obj_name in table_dict]
        
        saved_tables[active_table_name] = new_table_list
        session['saved_tables'] = saved_tables
        flash(f"Ordem das linhas da tabela '{active_table_name}' foi salva.", "success")

    return redirect(url_for('minhas_tabelas'))


@app.route("/reanalisar", methods=["POST"])
def reanalyze():
    active_table_name = session.get('active_table')
    saved_tables = session['saved_tables']
    table_list = saved_tables.get(active_table_name, [])
    if not table_list:
        return redirect(url_for('minhas_tabelas'))
        
    old_df = pd.DataFrame(table_list)
    objetos_para_reanalise = old_df['Objeto'].tolist()
    
    new_df = run_full_search_logic(objetos_para_reanalise)
    
    notifications = []
    if new_df is not None:
        old_df_sorted = old_df.set_index('Objeto')
        new_df_sorted = new_df.set_index('Objeto')
        common_objects = old_df_sorted.index.intersection(new_df_sorted.index)
        
        for obj in common_objects:
            for col in old_df_sorted.columns:
                if col in new_df_sorted.columns:
                    old_val, new_val = old_df_sorted.loc[obj, col], new_df_sorted.loc[obj, col]
                    if str(old_val) != str(new_val):
                        notifications.append(f"<b>{obj}</b>: <i>'{col}'</i> foi de '{old_val}' para '<b>{new_val}</b>'.")
        
        saved_tables[active_table_name] = new_df.to_dict('records')
        session['saved_tables'] = saved_tables
    
    if not notifications:
        notifications.append("✅ Nenhum dado foi alterado. Sua tabela já estava atualizada.")
    
    session['notifications'] = notifications
    return redirect(url_for('minhas_tabelas'))

if __name__ == '__main__':
    app.run(debug=True)