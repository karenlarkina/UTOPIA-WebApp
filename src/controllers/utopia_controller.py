import os
import csv
from src.models.script_UTOPIA_user import execute_utopia_model

# Function to read CSV files from a folder
def read_csv_files(folder_path):
    csv_files = []
    # print(folder_path)
    for file in os.listdir(folder_path):
        # print(f'path: {file}')
        if file.endswith(".csv"):
            csv_files.append(file)
    return csv_files

# Function to read CSV files and generate HTML tables
def assemble_html_table(folder_path, csv_files):
    tables = []
    for file in csv_files:
        file_path = os.path.join(folder_path, file)
        with open(file_path, 'r', newline='') as csv_file:
            reader = csv.reader(csv_file)
            table_data = []
            for row in reader:
                table_data.append(row)
            tables.append((file, table_data))
    return tables


#Amilcar, use this method to convert the format from the Prado's code to the required format of D3 heatmap
def convert_format_python_to_d3(df):
    # Reset index to convert MultiIndex to columns
    df.reset_index(inplace=True)

    # Melt the DataFrame
    melted_df = df.melt(id_vars=['MP_Form', 'Size_Fraction_um'], var_name='variable', value_name='value')

    # Concatenate 'MP_Form' and 'Size_Fraction_um' to form the 'variable'
    melted_df['group'] = melted_df['MP_Form'] + ' + ' + melted_df['Size_Fraction_um'].astype(str)

    # Drop unnecessary columns
    melted_df.drop(columns=['MP_Form', 'Size_Fraction_um'], inplace=True)

    # Reorder columns
    melted_df = melted_df[['group', 'variable', 'value']]

    return melted_df.to_csv(index=False)

def run_utopia(input_obj):
    heatmap_df = execute_utopia_model(input_obj)
    return convert_format_python_to_d3(heatmap_df)