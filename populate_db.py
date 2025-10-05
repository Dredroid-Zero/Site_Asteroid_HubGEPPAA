import os
import csv
import psycopg2
from dotenv import load_dotenv

load_dotenv()

CSV_FILE_PATH = 'mcti_data.csv'
DATABASE_URL = os.environ.get('DATABASE_URL')

def populate_database():
    if not os.path.exists(CSV_FILE_PATH):
        print(f"Erro: O ficheiro '{CSV_FILE_PATH}' não foi encontrado.")
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

    print(f"Encontradas {total_rows} linhas no CSV. A iniciar a importação...")
    
    conn = None
    inserted_count = 0
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        for i, row in enumerate(data_to_insert):
            print(f"  Inserindo linha {i + 1} de {total_rows}...", end='\r')
            
            # Mapeamento atualizado, sem a coluna "Status"
            mapped_row = {
                "Objeto": row.get("Objeto"),
                "Observadores": row.get("Observadores"),
                "Equipe": row.get("Equipe"),
                "Localizacao": row.get("Localização"),
                "Data": row.get("Data"),
                "Linked": row.get("Linked"),
                "Periodo": row.get("Período"),
                "Ano": row.get("Ano")
            }
            
            # Comando SQL atualizado, sem a coluna "Status"
            cur.execute("""
                INSERT INTO mcti_detections ("Objeto", "Observadores", "Equipe", "Localizacao", "Data", "Linked", "Periodo", "Ano")
                VALUES (%(Objeto)s, %(Observadores)s, %(Equipe)s, %(Localizacao)s, %(Data)s, %(Linked)s, %(Periodo)s, %(Ano)s)
                ON CONFLICT ("Objeto") DO NOTHING;
            """, mapped_row)
            inserted_count += cur.rowcount

        conn.commit()
        print("\n\nImportação concluída com sucesso!")
        print(f"{inserted_count} novas linhas foram inseridas.")
        if inserted_count < total_rows:
            print(f"{total_rows - inserted_count} linhas foram ignoradas (provavelmente por já existirem).")

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"\nOcorreu um erro durante a inserção: {error}")
    finally:
        if conn is not None:
            cur.close()
            conn.close()
            print("Conexão com o banco de dados fechada.")

if __name__ == '__main__':
    populate_database()