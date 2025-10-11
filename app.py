import os
import psycopg2
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from services import run_full_search_logic

load_dotenv()
# Vamos manter a definição explícita da pasta estática, pois é boa prática.
app = Flask(__name__, static_folder='static')

def get_db_connection():
    conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
    return conn

# ===== ROTA DE DIAGNÓSTICO ADICIONADA AQUI =====
@app.route('/debug-list-files')
def debug_list_files():
    """
    Lista todos os ficheiros e pastas a partir da raiz do projeto no servidor.
    Isto vai nos mostrar se as pastas 'static' e 'templates' existem no deploy.
    """
    path = '.'
    file_list = []
    for root, dirs, files in os.walk(path):
        for name in files:
            file_list.append(os.path.join(root, name))
        for name in dirs:
            file_list.append(os.path.join(root, name) + '/')
    
    # Retorna a lista como um JSON para fácil visualização
    return jsonify({
        "message": "Estrutura de ficheiros no servidor da Vercel:",
        "current_working_directory": os.getcwd(),
        "directory_listing": file_list
    })
# ==================================================

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/deteccoes-mcti")
def deteccoes_mcti():
    return render_template('mcti.html')

@app.route("/minhas-tabelas")
def minhas_tabelas():
    return render_template('minha_tabela.html')

@app.route("/configuracoes")
def configuracoes():
    return render_template('configuracoes.html')

@app.route("/faq")
def faq():
    return render_template('faq.html')

# (O resto do seu código continua igual, sem alterações)
@app.route("/api/run-search", methods=['POST'])
def api_run_search():
    data = request.json
    identificadores_query = data.get('identificadores', '')
    prelim_list = [code.strip() for code in identificadores_query.splitlines() if code.strip()]
    if not prelim_list:
        return jsonify([])
    full_df = run_full_search_logic(prelim_list)
    if full_df is None or full_df.empty:
        return jsonify([])
    results = full_df.to_dict('records')
    return jsonify(results)

@app.route("/api/mcti-filter-options")
def mcti_filter_options():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT DISTINCT "Ano", "Periodo" FROM mcti_detections WHERE "Ano" IS NOT NULL AND "Periodo" IS NOT NULL ORDER BY "Ano" DESC, "Periodo" ASC;')
    options_map = {}
    for ano, periodo in cur.fetchall():
        if ano not in options_map:
            options_map[ano] = []
        if periodo and periodo.strip():
            p_trimmed = periodo.strip()
            if p_trimmed not in options_map[ano]:
                    options_map[ano].append(p_trimmed)
    cur.close()
    conn.close()
    return jsonify(options_map)

@app.route("/api/search-mcti", methods=['GET'])
def api_search_mcti():
    filtro_ano = request.args.get('ano', '')
    filtro_periodo = request.args.get('periodo', '')

    if not filtro_ano or not filtro_periodo:
        return jsonify({"error": "É necessário selecionar um Ano e um Período."}), 400

    query = '''
        SELECT * FROM mcti_detections
        WHERE "Ano" = %s AND TRIM("Periodo") = %s
        ORDER BY "Data" DESC;
    '''
    params = (filtro_ano, filtro_periodo)
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query, params)
    
    colnames = [desc[0] for desc in cur.description]
    detections = cur.fetchall()
    
    cur.close()
    conn.close()
    
    results = []
    for row in detections:
        results.append(dict(zip(colnames, row)))
    
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
