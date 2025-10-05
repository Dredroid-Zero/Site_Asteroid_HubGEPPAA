import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do ficheiro .env
load_dotenv()

def upload_csv_to_db():
    """
    Lê os dados do ficheiro mcti_data.csv e insere-os
    na tabela mcti_detections da base de dados.
    """
    # Verifica se o ficheiro CSV existe
    if not os.path.exists('mcti_data.csv'):
        print("Erro: O ficheiro 'mcti_data.csv' não foi encontrado.")
        return

    # Lê os dados do CSV para um DataFrame do pandas
    try:
        df = pd.read_csv('mcti_data.csv')
        print(f"Sucesso: {len(df)} linhas lidas do ficheiro mcti_data.csv.")
    except Exception as e:
        print(f"Erro ao ler o ficheiro CSV: {e}")
        return

    conn = None
    try:
        # Conecta-se à base de dados usando a URL do ficheiro .env
        conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        cur = conn.cursor()

        # Itera sobre cada linha do DataFrame e a insere na base de dados
        for index, row in df.iterrows():
            # O comando ON CONFLICT faz com que ele ignore a inserção se um "Objeto" com o mesmo nome já existir
            # Isto evita erros de duplicação e permite que você execute o script várias vezes sem problemas.
            cur.execute(
                '''
                INSERT INTO mcti_detections ("Objeto", "Observadores", "Equipe", "Localizacao", "Data", "Linked", "Periodo", "Ano")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("Objeto") DO NOTHING; 
                ''',
                (
                    row.get('Objeto'),
                    row.get('Observadores'),
                    row.get('Equipe'),
                    row.get('Localização'), # Note o 'ç' para corresponder ao CSV
                    row.get('Data'),
                    row.get('Linked?'),     # Note o '?' para corresponder ao CSV
                    row.get('Período'),     # Note o acento para corresponder ao CSV
                    row.get('Ano')
                )
            )
        
        # Confirma as alterações na base de dados
        conn.commit()

        # Fecha a comunicação
        cur.close()

        print(f"Sucesso: Os dados foram inseridos na tabela 'mcti_detections'.")

    except Exception as e:
        print(f"Ocorreu um erro ao conectar ou inserir os dados: {e}")
    finally:
        if conn is not None:
            conn.close()

# Executa a função quando o script é chamado diretamente
if __name__ == '__main__':
    upload_csv_to_db()