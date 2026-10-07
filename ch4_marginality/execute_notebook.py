"""Execute the dedicated notebook inside a Colab runtime, preserving outputs on failure."""
from pathlib import Path
import json,traceback,sys
import nbformat
from nbclient import NotebookClient

base=Path(__file__).resolve().parent
dest=base.parent/'CH4_Marginality_executed.ipynb'
nb=nbformat.read(base/'CH4_Marginality.ipynb',as_version=4)
client=NotebookClient(nb,timeout=7200,kernel_name='python3',resources={'metadata':{'path':str(base.parent)}})
try:
    client.execute()
    (base.parent/'execution_status.json').write_text(json.dumps({'status':'completed'}))
except Exception:
    (base.parent/'execution_status.json').write_text(json.dumps({'status':'failed','traceback':traceback.format_exc()}))
    raise
finally:
    nbformat.write(nb,dest)
