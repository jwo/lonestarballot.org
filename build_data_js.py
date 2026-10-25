#!/usr/bin/env python3
"""Generate data.js from parsed_data.json. Run after make_data.py."""
import json
d = json.load(open('parsed_data.json'))
years = ', '.join(sorted(d.keys()))
js = json.dumps(d, indent=1, ensure_ascii=False)
out = ("/*\n"
       "  BALLOT DATA — generated from parsed_data.json (see make_data.py).\n"
       "  Regenerate with:  python3 make_data.py && python3 build_data_js.py\n"
       f"  Years: {years}\n"
       "*/\n"
       f"const BALLOT_DATA = {js};\n")
open('data.js', 'w').write(out)
print('wrote data.js')
