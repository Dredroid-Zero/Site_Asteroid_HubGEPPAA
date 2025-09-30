from flask import Flask, render_template, request, jsonify
from services import run_full_search_logic

app = Flask(__name__)

# Rota para a página principal de busca
@app.route("/")
def index():
    return render_template('index.html')

# Rota para a página de gerenciamento de tabelas
@app.route("/minhas-tabelas")
def minhas_tabelas():
    return render_template('minha_tabela.html')

# Rota para a página de configurações
@app.route("/configuracoes")
def configuracoes():
    return render_template('configuracoes.html')

# Nossa única API: busca os dados e devolve para o JavaScript
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

if __name__ == '__main__':
    app.run(debug=True)