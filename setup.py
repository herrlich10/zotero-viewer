from setuptools import setup, find_packages

setup(
    name="zotero-viewer",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "flask>=2.0.0",
        "click>=8.0.0",
    ],
    entry_points={
        "console_scripts": [
            "zotero-viewer=zotero_viewer.app:main",
        ],
    },
    author="Your Name",
    author_email="your.email@example.com",
    description="A web-based viewer for Zotero references",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/zotero-viewer",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.6",
)