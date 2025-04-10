from setuptools import setup, find_packages
import os
from zotero_viewer import __version__

# Read the long description from README.md
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="zotero-viewer",
    version=__version__,
    author="herrlich10",
    author_email="herrlich10@gmail.com",
    description="A web-based viewer for Zotero references with advanced tagging and search capabilities",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/herrlich10/zotero-viewer",
    packages=find_packages(),
    include_package_data=True,
    license="MIT",  # or whatever license you're using
    license_files=["LICENSE"],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Information Analysis",
    ],
    python_requires=">=3.6",
    install_requires=[
        "flask>=2.0.0",
        "click>=7.0",
    ],
    entry_points={
        "console_scripts": [
            "zotero-viewer=zotero_viewer:main",
        ],
    },
)