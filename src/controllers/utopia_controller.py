import os
import csv
import numpy as np
import pandas as pd
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

    return melted_df.to_csv(index=False)


# Function to convert the extended results (information per each cell in each compartment) dataframe to d3 svg
def convert_python_table_format_to_d3(df):
    # Reset index to convert MultiIndex to columns
    df.reset_index(inplace=True)

    # Melt the DataFrame
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

    # Concatenate 'MP_Form' and 'Size_Fraction_um' to form the 'group' and 'Compartment' to 'variable'
    melted_df['group'] = melted_df['MP_Form'] + ' + ' + melted_df['Size_Fraction_um'].astype(str)
    melted_df['variable'] = melted_df['Compartment'].astype(str)

    # Drop unnecessary columns
    melted_df.drop(columns=['MP_Form', 'Size_Fraction_um', 'Compartment'], inplace=True)

    # Apply log transformation to 'mass_g' and 'number_of_particles' to normalize data
    num = 0
    new_columns = ['mass', 'number']
    for col in ['mass_fraction', 'number_fraction']:
        # Apply log scale
        melted_df[new_columns[num]] = np.log10(melted_df[col])

        # Replace -inf values with NaN
        melted_df[new_columns[num]].replace(-np.inf, np.nan, inplace=True)

        # Set the lower limit and replace values below it with 0
        lower_limit = -14  # Example lower limit
        melted_df[new_columns[num]] = melted_df[new_columns[num]].apply(lambda x: np.NaN if x < lower_limit else x)
        num += 1

    melted_df = melted_df[['variable', 'group',
                           'mass_g',
                           'number_of_particles',
                           'concentration_g_m3',
                           'concentration_num_m3',
                           'mass_fraction',  # --> multiply by 100 to obtain %of total mass
                           'number_fraction',  # --> multiply by 100 to obtain %of total particle number
                           'mass',
                           'number',
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

    return melted_df.to_csv(index=True)


# Function to convert the extended results compartments dataframe to d3 svg
def convert_compdf_to_d3_format(compartment_df):
    # Reset index to convert MultiIndex to columns
    compartment_df.reset_index(inplace=True)

    compartment_df['percent_mass'] = compartment_df['%_mass'].astype(str)
    compartment_df['percent_number'] = compartment_df['%_number'].astype(str)

    # results_by_comp column names: ['Compartments', 'mass_g', 'number_of_particles', '%_mass', '%_number',
    # 'Concentration_g_m3', 'Concentration_num_m3', 'inflows_g_s', 'inflows_num_s', 'outflows_g_s', 'outflows_num_s',
    # 'Residence_time_mass_years', 'Residence_time_num_years', 'Persistence_time_mass_years', 'Persistence_time_num_years,
    # 'outflow_conexions_num_s','outflow_conexions_g_s']
    
    # Melt the DataFrame
    melted_df = compartment_df.melt(id_vars=['Compartments', 'mass_g', 'number_of_particles', 'percent_mass', 'percent_number',
                                             'Concentration_g_m3', 'Concentration_num_m3', 'inflows_g_s',
                                             'inflows_num_s', 'outflows_g_s', 'outflows_num_s',
                                             'Residence_time_mass_years', 'Residence_time_num_years',
                                             'Persistence_time_mass_years', 'Persistence_time_num_years', 'outflow_conexions_num_s',
                                             'outflow_conexions_g_s'],
                                    var_name='variable', value_name='value')

    # Removing duplicates
    melted_df = melted_df.drop_duplicates(subset="Compartments")

    melted_df['variable'] = melted_df['Compartments'].astype(str)

    return melted_df.to_csv(index=False)


# Function to convert a regular python dictionary into a
def convert_dict_to_d3_format(global_info_dict):
    data_list = []  # list to store the data
    for key, value in global_info_dict.items():  # populating the list
        data_list.append({'variable': key, 'value': value})

    # converting data from list to a dataframe
    df = pd.DataFrame(data_list)
    return df.to_csv(index=False)


def run_utopia(input_obj):
    heatmap_mass_fraction_df, heatmap_number_fraction_df, extended_results_df, global_info_dict, extended_comp = execute_utopia_model(input_obj)
    return convert_format_python_to_d3(heatmap_mass_fraction_df), convert_format_python_to_d3(heatmap_number_fraction_df), convert_python_table_format_to_d3(extended_results_df), convert_dict_to_d3_format(global_info_dict), convert_compdf_to_d3_format(extended_comp)