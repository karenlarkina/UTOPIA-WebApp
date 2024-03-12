import os
from flask import Flask
from flask import render_template
from flask import send_from_directory

from src.controllers.handleCSV import assemble_html_table, read_csv_files

# Set the views folders' paths
template_dir = os.path.abspath('./src/views/templates')
static_dir = os.path.abspath('./src/views/static')
app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

#Set csv path
csv_path = static_dir +'/csv'
#Set HTTP paths for HTML pages
@app.route('/')
def index():
    csv_files = read_csv_files(csv_path)
    tables = assemble_html_table(csv_path, csv_files)
    return render_template('index.html', tables=tables)    

@app.route('/csv/<path:filename>')
def csv_file(filename):    
    return send_from_directory(static_dir, filename)

if __name__ == '__main__':
    app.run(debug=True)