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


# Amilcar, use this method to convert the format from the Prado's code to the required format of D3 heatmap
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

    # print("ORIGINAL MELTER:\n", melted_df.to_csv(index=False))
    # print("\n\nNUMBER OF ORIGINAL ELEMENTS:\n", len(melted_df.to_csv(index=False)))
    return melted_df.to_csv(index=False)


# Function to convert the extended results dataframe to d3 svg
def convert_python_table_format_to_d3(df):

    df.reset_index(inplace=True)

    melted_df = df.melt(id_vars=['Compartment', 'MP_Form', 'Size_Fraction_um',
                                  'mass_g',
                                  'number_of_particles',
                                  'concentration_g_m3',
                                  'concentration_num_m3',
                                  'mass_fraction', # --> multiply by 100 to obtain %of total mass
                                  'number_fraction', # --> multiply by 100 to obtain %of total particle number
                                  'inflows_g_s',
                                  'inflows_num_s',
                                  'outflows_g_s',
                                  'outflows_num_s',
                                  'Total_inflows_g_s',
                                  'Total_outflows_g_s',
                                  'Total_inflows_num_s',
                                  'Total_outflows_num_s',
                                  'Residence_time_mass_years',
                                  'Residence_time_num_years',
                                  'Persistence_time_mass_years',
                                  'Persistence_time_num_years'], var_name='variable', value_name='value')

    melted_df = melted_df[['Compartment', 'MP_Form', 'Size_Fraction_um',
                           'mass_g',
                           'number_of_particles',
                           'concentration_g_m3',
                           'concentration_num_m3',
                           'mass_fraction', # --> multiply by 100 to obtain %of total mass
                           'number_fraction', # --> multiply by 100 to obtain %of total particle number
                           'inflows_g_s',
                           'inflows_num_s',
                           'outflows_g_s',
                           'outflows_num_s',
                           'Total_inflows_g_s',
                           'Total_outflows_g_s',
                           'Total_inflows_num_s',
                           'Total_outflows_num_s',
                           'Residence_time_mass_years',
                           'Residence_time_num_years',
                           'Persistence_time_mass_years',
                           'Persistence_time_num_years']]

    # Converting into a csv string
    csv_df = melted_df.to_csv(index=False)

    # print("\n\nNUMBER OF EXTENDED ELEMENTS:\n", len(csv_df))

    return csv_df


def run_utopia(input_obj):
    heatmap_mass_fraction_df, heatmap_number_fraction_df, extended_results_df = execute_utopia_model(input_obj)
    return convert_format_python_to_d3(heatmap_mass_fraction_df), convert_format_python_to_d3(heatmap_number_fraction_df), convert_python_table_format_to_d3(extended_results_df)