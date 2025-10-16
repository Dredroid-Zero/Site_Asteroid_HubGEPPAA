import os
import psycopg2
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from services import run_full_search_logic

load_dotenv()
app = Flask(__name__, static_folder='static')

def get_db_connection():
    conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
    return conn

# A rota /init-db agora é menos importante, pois usamos o populate_db.py,
# mas vamos atualizá-la por consistência.
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
                "Campanha" TEXT, -- <<< ALTERAÇÃO AQUI
                "Ano" VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        conn.commit()
        cur.close()
        conn.close()
        return "Tabela 'mcti_detections' recriada com sucesso com a coluna 'Campanha'!"
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

@app.route("/faq")
def faq():
    return render_template('faq.html')

# (Rotas de debug e api/run-search não precisam de alteração)
@app.route('/debug-mcti')
def debug_mcti():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM mcti_detections;')
        colnames = [desc[0] for desc in cur.description]
        detections = cur.fetchall()
        cur.close()
        conn.close()
        results = []
        for row in detections:
            results.append(dict(zip(colnames, row)))
        if not results:
            return jsonify({"message": "A query foi executada com sucesso, mas a tabela 'mcti_detections' está vazia."})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})

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

# --- ALTERAÇÕES IMPORTANTES ABAIXO ---

@app.route("/api/mcti-filter-options")
def mcti_filter_options():
    conn = get_db_connection()
    cur = conn.cursor()
    # 1. Mudar a query SQL
    cur.execute('SELECT DISTINCT "Ano", "Campanha" FROM mcti_detections WHERE "Ano" IS NOT NULL AND "Campanha" IS NOT NULL ORDER BY "Ano" DESC, "Campanha" ASC;')
    options_map = {}
    # 2. Mudar os nomes das variáveis para clareza
    for ano, campanha in cur.fetchall():
        if ano not in options_map:
            options_map[ano] = []
        if campanha and campanha.strip():
            c_trimmed = campanha.strip()
            if c_trimmed not in options_map[ano]:
                    options_map[ano].append(c_trimmed)
    cur.close()
    conn.close()
    return jsonify(options_map)

@app.route("/api/search-mcti", methods=['GET'])
def api_search_mcti():
    filtro_ano = request.args.get('ano', '')
    # 3. Mudar o parâmetro que vem da URL e o nome da variável
    filtro_campanha = request.args.get('campanha', '')

    # 4. Mudar a validação e a mensagem de erro
    if not filtro_ano or not filtro_campanha:
        return jsonify({"error": "É necessário selecionar um Ano e uma Campanha."}), 400

    # 5. Mudar a query SQL
    query = '''
        SELECT * FROM mcti_detections
        WHERE "Ano" = %s AND TRIM("Campanha") = %s
        ORDER BY "Data" DESC;
    '''
    # 6. Mudar os parâmetros da query
    params = (filtro_ano, filtro_campanha)
    
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