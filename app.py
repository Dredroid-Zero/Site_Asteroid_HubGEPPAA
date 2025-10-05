import os
import psycopg2
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from services import run_full_search_logic

load_dotenv()
app = Flask(__name__)

def get_db_connection():
    conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
    return conn

@app.route('/init-db')
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS mcti_detections;")
        cur.execute('''
            CREATE TABLE mcti_detections (
                id SERIAL PRIMARY KEY,
                "Objeto" VARCHAR(50) UNIQUE NOT NULL,
                "Observadores" TEXT,
                "Equipe" TEXT,
                "Localizacao" TEXT,
                "Data" TEXT,
                "Linked" TEXT,
                "Periodo" TEXT,
                "Ano" VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        conn.commit()
        cur.close()
        conn.close()
        return "Tabela 'mcti_detections' recriada com sucesso com as colunas corretas!"
    except Exception as e:
        return f"Ocorreu um erro ao criar a tabela: {e}"

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

# ----- NOVA ROTA ADICIONADA AQUI -----
@app.route("/faq")
def faq():
    """Renderiza a página de Perguntas Frequentes (FAQ)."""
    return render_template('faq.html')
# ------------------------------------

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