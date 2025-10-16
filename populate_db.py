import os
import sys
import csv
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("ERRO CRÍTICO: A variável de ambiente DATABASE_URL não foi encontrada.")
    print("Verifique se o ficheiro .env está correto.")
    sys.exit()

CSV_FILE_PATH = 'mcti_data.csv'

def setup_database_tables(cur):
    """Cria ou recria todas as tabelas necessárias."""
    print("A recriar a tabela 'mcti_detections' com a nova coluna 'Campanha'...")
    # Para garantir a mudança de nome, vamos apagar a tabela antiga primeiro.
    cur.execute("DROP TABLE IF EXISTS mcti_detections;")
    
    # --- ALTERAÇÃO FEITA AQUI ---
    cur.execute("""
        CREATE TABLE mcti_detections (
            id SERIAL PRIMARY KEY,
            "Objeto" VARCHAR(50) UNIQUE NOT NULL,
            "Observadores" TEXT,
            "Equipe" TEXT,
            "Localizacao" TEXT,
            "Data" TEXT,
            "Linked" TEXT,
            "Campanha" TEXT, 
            "Ano" VARCHAR(10),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    print("Tabela 'mcti_detections' recriada com sucesso.")

def populate_mcti_data(cur):
    """Popula a tabela mcti_detections, atualizando linhas existentes se necessário."""
    if not os.path.exists(CSV_FILE_PATH):
        print(f"Aviso: O ficheiro '{CSV_FILE_PATH}' não foi encontrado. A pular a importação.")
        return

    try:
        with open(CSV_FILE_PATH, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            data_to_insert = list(reader)
            total_rows = len(data_to_insert)
    except Exception as e:
        print(f"Ocorreu um erro ao ler o ficheiro CSV: {e}")
        return

    if total_rows == 0:
        print("O ficheiro CSV está vazio.")
        return

    print(f"Encontradas {total_rows} linhas no CSV do MCTI. A iniciar a importação/atualização...")
    
    for i, row in enumerate(data_to_insert):
        print(f"  Processando linha {i + 1} de {total_rows}...", end='\r')
        
        # --- ALTERAÇÃO FEITA AQUI ---
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
        
        # --- ALTERAÇÃO FEITA AQUI ---
        cur.execute("""
            INSERT INTO mcti_detections ("Objeto", "Observadores", "Equipe", "Localizacao", "Data", "Linked", "Campanha", "Ano")
            VALUES (%(Objeto)s, %(Observadores)s, %(Equipe)s, %(Localizacao)s, %(Data)s, %(Linked)s, %(Campanha)s, %(Ano)s)
            ON CONFLICT ("Objeto") DO UPDATE SET
                "Observadores" = EXCLUDED."Observadores",
                "Equipe" = EXCLUDED."Equipe",
                "Localizacao" = EXCLUDED."Localizacao",
                "Data" = EXCLUDED."Data",
                "Linked" = EXCLUDED."Linked",
                "Campanha" = EXCLUDED."Campanha",
                "Ano" = EXCLUDED."Ano";
        """, mapped_row)
    
    print("\n\nTodas as linhas foram processadas. A finalizar e salvar no banco de dados...")

def main():
    conn = None
    try:
        print("URL do banco de dados encontrada. A conectar ao Supabase...")
        conn = psycopg2.connect(DATABASE_URL)
        print("Conexão estabelecida com sucesso!")
        cur = conn.cursor()

        setup_database_tables(cur)
        populate_mcti_data(cur)
        
        conn.commit()
        print("\nOperação na base de dados concluída com sucesso!")

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"\nOcorreu um erro: {error}")
        if conn:
            conn.rollback()
    finally:
        if conn is not None:
            cur.close()
            conn.close()
            print("Conexão com o banco de dados fechada.")

if __name__ == '__main__':
    main()