"""
Locust load test for UTOPIA WebApp — v3 (exact payload)
https://utopia-webapp.onrender.com/

HOW TO RUN:
  1. pip install locust
  2. locust --host=https://utopia-webapp.onrender.com
  4. Open http://localhost:8089 or press enter to open in browser
  5. Set users=20, ramp-up=2, click Start
"""

import random
from locust import HttpUser, task, between


COMPOSITIONS = ["PVC", "PE", "PA"]

DENSITIES = {          # kg/m3, one realistic density per plastic type
    "PVC": 1580,
    "PE":  960,
    "PA":  1140,
}

# fragmentation_style is sent as a numeric index (0=Erosive,1=Mixed,2=Sequential)
# based on the CSV showing value "0" for Erosive
FRAG_STYLES = [0, 1, 2]

MP_FORMS = ["freeMP", "Heter", "Biof", "HeterBiof"]

# size_bin is sent as a letter (a=0.5µm, b=5µm, c=50µm, d=500µm, e=5000µm)
# based on CSV showing "a" for 0.5µm
SIZE_BINS = ["a", "b", "c", "d", "e"]

COMPARTMENTS = [
    "Ocean_Surface_Water", "Ocean_Mixed_Water", "Ocean_Column_Water",
    "Coast_Surface_Water", "Coast_Column_Water",
    "Surface_Freshwater", "Bulk_Freshwater",
    "Sediment_Freshwater", "Sediment_Ocean", "Sediment_Coast",
    "Beach_Surface", "Beach_Subsurface",
    "Background_Soil_Surface", "Background_Soil",
    "Impacted_Soil_Surface", "Impacted_Soil", "Air",
]


def make_payload():
    composition = random.choice(COMPOSITIONS)
    return {
        "MicroPhysProperties": {
            "MPdensity_kg_m3":          1580,
            "MP_composition":           "PVC",
            "shape":                    "sphere",
            "N_sizeBins":               5,
            "fragmentation_style":      0,
            "fragmentation_timescale":  36.5,
            "discorporation_timescale": 66000,
            "runName":                  "PVC",
        },
        "EmScenario": {
            "MPform":         "freeMP",
            "size_bin":       "a",
            "input_flow_g_s": 1,
            "emiss_comp":     "Ocean_Surface_Water",
        }
    }


class WorkshopParticipant(HttpUser):
    """
    Simulates one workshop participant:
      - lands on the page
      - configures parameters and hits Run Model repeatedly
    wait_time mimics realistic pauses (reading results, adjusting params).
    """
    wait_time = between(3, 8)

    @task(2)
    def load_home(self):
        with self.client.get("/", catch_response=True) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Home page returned {r.status_code}")

    @task(8)
    def run_model(self):
        with self.client.post(
            "/run_model",
            json=make_payload(),
            catch_response=True,
            name="POST /run_model",
        ) as r:
            if r.status_code == 200:
                try:
                    data = r.json()
                    # The JS reads these two keys from the response
                    if "global_info_dict" not in data and "extended_comp" not in data:
                        r.failure("Response missing expected keys — model may have failed silently")
                    else:
                        r.success()
                except Exception:
                    r.failure("Response is not valid JSON")
            elif r.status_code == 400:
                r.failure(f"400 Bad Request — {r.text[:300]}")
            elif r.status_code == 422:
                r.failure(f"422 Unprocessable — {r.text[:300]}")
            elif r.status_code == 500:
                r.failure("500 Server Error — check Render logs")
            else:
                r.failure(f"Unexpected {r.status_code}: {r.text[:200]}")

    @task(1)
    def load_static_assets(self):
        for path in ["/static/img/info-icon2.png", "/static/img/delete-icon2.png"]:
            self.client.get(path, name="GET /static/[img]")

    @task(1)
    def load_about(self):
        self.client.get("/static/about.html", name="GET /about")
