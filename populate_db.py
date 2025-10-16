import os
import sys
import csv
import psycopg2
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do ficheiro .env
load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')
CSV_FILE_PATH = 'mcti_data.csv'

def setup_database_tables(cur):
    """
    Apaga a tabela antiga (se existir) e a recria com a nova coluna "Campanha".
    """
    print("A recriar a tabela 'mcti_detections' com a nova estrutura...")
    cur.execute("DROP TABLE IF EXISTS mcti_detections;")
    
    cur.execute("""
        CREATE TABLE mcti_detections (
            id SERIAL PRIMARY KEY,
            "Objeto" VARCHAR(50) UNIQUE NOT NULL,
            "Observadores" TEXT,
            "Equipe" TEXT,
            "Localizacao" TEXT,
            "Data" TEXT,
            "Linked" TEXT,
            "Campanha" TEXT, -- <<< O NOME CORRETO ESTÁ AQUI
            "Ano" VARCHAR(10),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    print("✅ Tabela 'mcti_detections' recriada com sucesso.")

def populate_mcti_data(cur, data_to_insert):
    """
    Insere novos dados e atualiza os existentes na tabela mcti_detections.
    """
    total_rows = len(data_to_insert)
    print(f"Encontradas {total_rows} linhas no CSV. A iniciar a importação/atualização...")

    for i, row in enumerate(data_to_insert):
        print(f"  Processando linha {i + 1} de {total_rows}...", end='\r')
        
        # Mapeia os dados do CSV para as colunas do banco de dados
        mapped_row = {
            "Objeto": row.get("Objeto"),
            "Observadores": row.get("Observadores"),
            "Equipe": row.get("Equipe"),
            "Localizacao": row.get("Localização"),
            "Data": row.get("Data"),
            "Linked": row.get("Linked"),
            "Campanha": row.get("Período"), # Mapeia do CSV "Período" para a coluna "Campanha"
            "Ano": row.get("Ano")
        }
        
        # Insere uma nova linha ou atualiza uma existente se o "Objeto" já existir
        cur.execute("""
            INSERT INTO mcti_detections ("Objeto", "Observadores", "Equipe", "Localizacao", "Data", "Linked", "Campanha", "Ano")
            VALUES (%(Objeto)s, %(Observadores)s, %(Equipe)s, %(Localizacao)s, %(Data)s, %(Linked)s, %(Campanha)s, %(Ano)s)
            ON CONFLICT ("Objeto") DO UPDATE SET
                "Observadores" = EXCLUDED."Observadores",
                "Equipe" = EXCLUDED."Equipe",
                "Localizacao" = EXCLUDED."Localizacao",
                "Data" = EXCLUDED."Data",
                "Linked" = EXCLUDED."Linked",
                "Campanha" = EXCLUDED."Campanha", -- O NOME CORRETO ESTÁ AQUI
                "Ano" = EXCLUDED."Ano";
        """, mapped_row)
    
    print("\n\nTodas as linhas do CSV foram processadas.")

def main():
    """
    Função principal que orquestra a conexão e a população do banco de dados.
    """
    if not DATABASE_URL:
        print("❌ ERRO CRÍTICO: A variável de ambiente DATABASE_URL não foi encontrada.")
        return

    if not os.path.exists(CSV_FILE_PATH):
        print(f"❌ Erro: O ficheiro '{CSV_FILE_PATH}' não foi encontrado.")
        return

    try:
        with open(CSV_FILE_PATH, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            data_to_insert = list(reader)
    except Exception as e:
        print(f"❌ Ocorreu um erro ao ler o ficheiro CSV: {e}")
        return

    if not data_to_insert:
        print("⚠️ O ficheiro CSV está vazio.")
        return

    conn = None
    try:
        print("A conectar ao banco de dados Supabase...")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        setup_database_tables(cur)
        populate_mcti_data(cur, data_to_insert)
        
        conn.commit()
        print("\n✅ Operação na base de dados concluída com sucesso!")

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"\n❌ Ocorreu um erro durante a operação: {error}")
        if conn:
            conn.rollback()
    finally:
        if conn is not None:
            cur.close()
            conn.close()
            print("Conexão com o banco de dados fechada.")

if __name__ == '__main__':
    main()