import os
from flask import Flask, request, jsonify
from flask import render_template
from flask import send_from_directory
from flask_cors import CORS
import warnings
from src.controllers.utopia_controller import assemble_html_table, read_csv_files, run_utopia

warnings.simplefilter(action='ignore', category=FutureWarning)

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

@app.route('/run_model', methods=['POST'])
def post_model_run():
    # Retrieve the data sent in the POST request
    data = request.json    
    heatmap_mass_fraction, heatmap_number_fraction, extended_table, global_info_dict = run_utopia(data)
    return jsonify({'mass_fraction_distribution_heatmap': heatmap_mass_fraction,
                    'number_fraction_distribution_heatmap': heatmap_number_fraction,
                    'extended_csv_table': extended_table,
                    'global_info_dict': global_info_dict,
                    })

@app.route('/csv/<path:filename>')
def csv_file(filename):    
    return send_from_directory(static_dir, filename)

if __name__ == '__main__':
    app.run(debug=True)