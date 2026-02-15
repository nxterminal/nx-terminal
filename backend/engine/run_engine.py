"""
NX TERMINAL — Engine Runner
Wrapper to run the engine as a module from the repo root.
Usage: python -m backend.engine.run_engine
"""

import sys
import os

# Add engine directory to path so engine.py's imports work
engine_dir = os.path.dirname(os.path.abspath(__file__))
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)

from engine import run_engine

if __name__ == "__main__":
    run_engine()
