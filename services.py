import pandas as pd
import requests
from requests.exceptions import RequestException
from bs4 import BeautifulSoup
import asyncio
import aiohttp

# --- Constantes ---
ALL_COLUMNS = [
    'Objeto', 'Status do objeto', 'Designação IAU', 'String da Observação', '(*?)',
    'Linhas de Observação WAMO', 'Status de Consulta', 'Tipo de Órbita',
    'Magnitude Absoluta', 'Incerteza', 'Referência', 'Observações Utilizadas',
    'Oposições', 'Comprimento do Arco (dias)', 'Primeira Oposição Usada',
    'Última Oposição Usada', 'Primeira Data de Obs. Usada',
    'Última Data de Obs. Usada', 'Descrição'
]

# PADRÃO DE COLUNAS (lista para ordem estável)
DEFAULT_COLUMNS = [
    'Objeto',
    'Status do objeto',
    '(*?)',
    'Designação IAU',
    'Tipo de Órbita',
    'Incerteza',
    'Descrição'
]


# --- Funções de Lógica ---
def extract_orbital_data_from_html(html_content: str):
    soup = BeautifulSoup(html_content, 'html.parser')
    data = {}
    try:
        first_obs_p = soup.find(string=lambda s: "Initial reported observation" in s or "Discovered" in s)
        data['Descrição'] = first_obs_p.strip() if first_obs_p else None
        orbit_type_p = soup.find(string=lambda s: "Orbit type:" in s)
        data['Tipo de Órbita'] = orbit_type_p.split(':')[-1].strip() if orbit_type_p else None
    except Exception:
        pass

    orbit_tables = soup.find_all('table', class_='nb')
    mapa_labels = {
        'absolute magnitude': 'Magnitude Absoluta',
        'uncertainty': 'Incerteza',
        'reference': 'Referência',
        'observations used': 'Observações Utilizadas',
        'oppositions': 'Oposições',
        'arc length (days)': 'Comprimento do Arco (dias)',
        'first opposition used': 'Primeira Oposição Usada',
        'last opposition used': 'Última Oposição Usada',
        'first observation date used': 'Primeira Data de Obs. Usada',
        'last observation date used': 'Última Data de Obs. Usada'
    }

    for table in orbit_tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True).replace('(°)', '').replace('(AU)', '')
                label = label.strip().lower()
                value = cells[1].get_text(strip=True)
                if label in mapa_labels:
                    data[mapa_labels[label]] = value
    return data

def get_object_status(row):
    status_consulta = str(row.get('Status de Consulta', ''))
    designacao_iau = str(row.get('Designação IAU', ''))
    objeto = str(row.get('Objeto', ''))
    if status_consulta != 'Publicado':
        return 'Preliminar'
    else:
        if designacao_iau.isdigit():
            return 'FNumerado' if objeto.startswith('IU') else 'Numerado'
        else:
            return 'FProvisório' if objeto.startswith('IU') else 'Provisório'

async def fetch_one(session, url, retries=3, initial_delay=1):
    delay = initial_delay
    for attempt in range(retries):
        try:
            async with session.get(url, timeout=30) as response:
                response.raise_for_status()
                return await response.text()
        except asyncio.TimeoutError:
            print(f"Timeout na tentativa {attempt + 1} para {url}")
        except aiohttp.ClientError as e:
            print(f"Erro de cliente na tentativa {attempt + 1} para {url}: {e}")

        if attempt < retries - 1:
            await asyncio.sleep(delay)
            delay *= 2

    return None

async def fetch_all_orbital_data_async(iau_desigs):
    base_url = "https://minorplanetcenter.net/db_search/show_object?object_id="
    results = {}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'}

    async with aiohttp.ClientSession(headers=headers) as session:
        tasks = []
        valid_desigs = []
        for desig in iau_desigs:
            if desig and desig != 'Não Encontrado' and desig != "-":
                clean_desig = desig.strip().replace(" ", "+").replace("(", "%28").replace(")", "%29")
                tasks.append(fetch_one(session, f"{base_url}{clean_desig}"))
                valid_desigs.append(desig)

        html_contents = await asyncio.gather(*tasks)

        for desig, html in zip(valid_desigs, html_contents):
            if html:
                results[desig] = html
    return results

def run_full_search_logic(prelim_list):
    all_combined_data = []
    CHUNK_SIZE = 25
    for i in range(0, len(prelim_list), CHUNK_SIZE):
        chunk = prelim_list[i:i + CHUNK_SIZE]
        final_search_list, prelim_to_final_map = [], {}
        for code in chunk:
            if code.startswith('P1'):
                final_id = f"{code} F51"
                final_search_list.append(final_id)
                prelim_to_final_map[final_id] = code
            elif code.startswith('P2'):
                final_id = f"{code} F52"
                final_search_list.append(final_id)
                prelim_to_final_map[final_id] = code
            else:
                final_id_f51, final_id_f52 = f"{code} F51", f"{code} F52"
                final_search_list.extend([final_id_f51, final_id_f52])
                prelim_to_final_map[final_id_f51] = code
                prelim_to_final_map[final_id_f52] = code
        try:
            response = requests.get("https://data.minorplanetcenter.net/api/wamo", json=final_search_list)
            response.raise_for_status()
            wamo_found_data = response.json().get('found', [])
        except RequestException:
            continue
        if not wamo_found_data:
            continue
        for found_item in wamo_found_data:
            for identifier, obs_list_for_id in found_item.items():
                if not obs_list_for_id:
                    continue
                selected_obs = obs_list_for_id[0]
                decoded_status = str(selected_obs.get('status_decoded', '')).lower()
                if 'published' in decoded_status:
                    status_consulta = 'Publicado'
                elif 'candidate for duplicate' in decoded_status:
                    status_consulta = 'Quase Duplicado'
                else:
                    status_consulta = "N/A"
                wamo_info = {
                    'Objeto': prelim_to_final_map.get(identifier, 'N/A'),
                    'Designação IAU': selected_obs.get('iau_desig', 'Não Encontrado'),
                    'String da Observação': selected_obs.get('obs80', '').split(maxsplit=1)[0],
                    'Linhas de Observação WAMO': len(obs_list_for_id),
                    'Status de Consulta': status_consulta
                }
                all_combined_data.append(wamo_info)

    if not all_combined_data:
        return None

    iau_desigs_to_fetch = [item['Designação IAU'] for item in all_combined_data]
    orbital_data_htmls = {}
    try:
        orbital_data_htmls = asyncio.run(fetch_all_orbital_data_async(iau_desigs_to_fetch))
    except RuntimeError:
        # Ambiente com loop já em execução (ex: alguns servidores ASGI). Faz fallback para novo loop.
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            orbital_data_htmls = loop.run_until_complete(fetch_all_orbital_data_async(iau_desigs_to_fetch))
        except Exception as e:
            print(f"Erro no fallback assíncrono: {e}")
            orbital_data_htmls = {}
    except Exception as e:
        print(f"Um erro crítico ocorreu durante a busca assíncrona: {e}")
        orbital_data_htmls = {}

    for item in all_combined_data:
        iau_desig = item['Designação IAU']
        html_content = orbital_data_htmls.get(iau_desig)
        if html_content:
            orbital_info = extract_orbital_data_from_html(html_content)
            item.update(orbital_info)

    df = pd.DataFrame(all_combined_data)
    if df.empty:
        return None

    df['Status do objeto'] = df.apply(get_object_status, axis=1)
    df['(*?)'] = df['String da Observação'].apply(lambda x: 'SIM' if '*' in str(x) else 'NÃO')
    df.fillna('-', inplace=True)
    return df
