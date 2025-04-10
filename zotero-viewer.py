#!/usr/bin/env python3
"""
Backward compatibility script for Zotero Viewer.
This script is maintained for compatibility with existing workflows.
For new installations, please use 'zotero-viewer' command after installing the package.
"""

import sys
from zotero_viewer import main  # Changed from relative import to absolute import

if __name__ == "__main__":
    sys.exit(main())