import json
import tempfile
import unittest
from pathlib import Path
from compiler.synapse_compiler.package_block import keccak256, q16, package_loomguard
class DerivationTests(unittest.TestCase):
    def test_keccak_and_rounding(self):
        self.assertEqual(keccak256(b'').hex(), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
        self.assertEqual(q16(-0.5/65536), -1)
    def test_recipe_is_reproducible(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as tmp:
            root=Path(tmp); source=root/'circuit.json'
            source.write_text(json.dumps({'name':'synthetic-test', 'nodes':[{'id':'a','lobe':'optic','driveRole':'lc4','side':'left'},{'id':'b','lobe':'optic','driveRole':'gf'}], 'edges':[{'pre':'a','post':'b','weight':2}], 'io':{'sensors':{'collision':['a'],'hazard':['a']},'escape':['b']}}))
            for folder in ['a','b']: package_loomguard(source,root/folder)
            for artifact in ['block.json','derivation.json','manifest.json']:
                self.assertEqual((root/'a'/artifact).read_bytes(),(root/'b'/artifact).read_bytes())
            recipe=json.loads((root/'a'/'derivation.json').read_text())
            self.assertEqual(recipe['calibration']['status'],'not independently calibrated')
if __name__=='__main__': unittest.main()
