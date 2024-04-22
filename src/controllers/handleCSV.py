import os
import csv

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
    # Concatenate 'MP_Form' and 'Size_Fraction_um' to create 'group' column
    df['group'] = df['MP_Form'] + ' - ' + df['Size_Fraction_um'].astype(str)

    # Drop 'MP_Form' and 'Size_Fraction_um' columns
    df.drop(columns=['MP_Form', 'Size_Fraction_um'], inplace=True)

    # Reshape the DataFrame
    df_transformed = df.melt(id_vars=['group'], var_name='variable', value_name='value')
    return df_transformed