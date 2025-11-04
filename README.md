# UTOPIA-WebApp

The UTOPIA web app is an interactive tool that enables users to explore the fate of microplastics across environmental compartments interactively within a unit world framework.

The User can select Microplastic properties as well and design emission scenarios via selection of the receiving compartment of emissions, selecting a flow of emissions, and the size and microplastic aggregation state for emission.

The application is available on https://utopia-webapp.onrender.com/. 

## About UTOPIA model

UTOPIA is an open-source evaluative unit world model that has been developed within the LRI ECO56 project UTOPIA: Development of a multimedia unit world Open-source model for microplastic. (link to the original project: https://cefic-lri.org/projects/eco-56-utopia-development-of-a-multimedia-unit-world-open-source-model-for-microplastic/).

UTOPIA is a platform to synthesize knowledge and understanding about the fate of microplastics in the environment. The model comprises 17 environmental compartments that cover the air, different types of soils, water, and sediments. It classifies plastics into five size bins, ranging from nano to millimeters, and monitors four speciation states (free, heteroaggregated, biofouled and biofouled and heteroaggregated) of these particles.

The model computes the steady-state distribution of microplastic masses and particle numbers across all compartments, size bins, and speciation states, and provides MP-relevant exposure metrics such as Overall Persistence, Overall Residence time, and Long-range transport potential metrics.


## Installation guidelines

In case you'd like to run the tool locally to get faster performance or to investigate it further, clone this repository and follow the instructions below.

### Create, activate, and download dependencies with a virtual environment using venv

```bash
# Create a virtual environment named 'venv'
python -m venv utopia-venv

# Activate the virtual environment on Windows
utopia-venv\Scripts\activate

# Activate the virtual environment on macOS and Linux
source utopia-venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

# Run server 
```bash
python app.py
```
