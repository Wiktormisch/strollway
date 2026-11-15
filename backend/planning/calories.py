"""A rough calorie estimate for a walk (audit idea 1). Deterministic, no LLM.

Formula: kcal = MET x weight (kg) x hours. MET values for level walking come from the
Compendium of Physical Activities; between the table points we interpolate linearly.
The weight is a fixed adult weight, so the app stores no body data (DECISIONS.md section 13).
"""

from itertools import pairwise

ADULT_WEIGHT_KG = 70
STROLLER_BONUS = 1.05  # pushing a stroller costs a little more (+5%)

# (pace in km/h, MET). Below or above the table we use the nearest value.
MET_BY_PACE = [
    (2.5, 2.3),
    (3.2, 2.8),
    (4.0, 3.0),
    (4.8, 3.5),
    (5.6, 4.3),
]


def met_for_pace(pace_kmh):
    """The MET value for a walking pace, interpolated from MET_BY_PACE."""
    first_pace, first_met = MET_BY_PACE[0]
    if pace_kmh <= first_pace:
        return first_met
    for (low_pace, low_met), (high_pace, high_met) in pairwise(MET_BY_PACE):
        if pace_kmh <= high_pace:
            share = (pace_kmh - low_pace) / (high_pace - low_pace)
            return low_met + share * (high_met - low_met)
    return MET_BY_PACE[-1][1]


def estimate_kcal(distance_m, pace_kmh, stroller=True):
    """Calories for walking `distance_m` at `pace_kmh`, rounded to whole kcal."""
    if distance_m <= 0 or pace_kmh <= 0:
        return 0
    hours = distance_m / 1000 / pace_kmh
    kcal = met_for_pace(pace_kmh) * ADULT_WEIGHT_KG * hours
    if stroller:
        kcal *= STROLLER_BONUS
    return round(kcal)
