#!/bin/bash
# Clean up previous builds
rm -rf build/ dist/ *.egg-info/

# Build the package
#python -m pip install --upgrade build
#python -m build

# Build the package using local environment
python setup.py sdist bdist_wheel

# Upload to PyPI
#python -m pip install --upgrade twine setuptools wheel packaging
python -m twine upload dist/*