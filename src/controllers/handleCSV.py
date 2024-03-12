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
