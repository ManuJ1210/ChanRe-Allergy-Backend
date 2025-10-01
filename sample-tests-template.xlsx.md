# Sample Excel Template for Lab Tests Import

## How to Create Your Excel File

### Required Columns (Must Have)

1. **Code** - Unique test code (e.g., CBC001, HB001)
2. **Test Name** - Full name of test (e.g., Complete Blood Count)
3. **Cost** - Price in INR as number only (e.g., 500, not ₹500)

### Optional Columns (Recommended)

4. **Category** - Test category (e.g., Hematology, Biochemistry, Allergy)
5. **Description** - What the test measures
6. **Sample Type** - Type of sample (e.g., Blood, Urine)
7. **Preparation Required** - Patient instructions (e.g., 8 hours fasting)
8. **Report Delivery Time** - How long for results (e.g., 24 hours)

---

## Sample Data to Copy into Excel

Copy this into your Excel file (first row should be headers):

```
Code	Test Name	Cost	Category	Description	Sample Type	Preparation Required	Report Delivery Time
CBC001	Complete Blood Count	500	Hematology	Measures blood cell counts	Blood	No fasting required	24 hours
HB001	Hemoglobin Test	200	Hematology	Measures hemoglobin levels	Blood	No fasting required	12 hours
ESR001	Erythrocyte Sedimentation Rate	150	Hematology	Inflammation marker	Blood	No fasting required	24 hours
PLT001	Platelet Count	200	Hematology	Clotting assessment	Blood	No fasting required	24 hours
WBC001	White Blood Cell Count	250	Hematology	Infection screening	Blood	No fasting required	24 hours
IGE001	Total IgE Test	800	Immunology	Allergy screening	Blood	No special preparation	48 hours
IGG001	Total IgG Test	900	Immunology	Immunity assessment	Blood	No special preparation	48 hours
ALLP-FOOD	Allergy Panel - Food	3500	Allergy	Tests for 20+ food allergens	Blood	Avoid antihistamines 72hrs before	5-7 days
ALLP-INH	Allergy Panel - Inhalants	3500	Allergy	Environmental allergens	Blood	Avoid antihistamines 72hrs before	5-7 days
ALLP-DRUG	Allergy Panel - Drug	4000	Allergy	Medication allergens	Blood	Avoid antihistamines 72hrs before	7 days
SPEC-IGE	Specific IgE (per allergen)	400	Allergy	Individual allergen test	Blood	Avoid antihistamines 48hrs before	3-5 days
GLUC-F	Fasting Blood Glucose	150	Biochemistry	Diabetes screening	Blood	8-12 hours fasting	24 hours
GLUC-PP	Post Prandial Glucose	150	Biochemistry	Blood sugar after meal	Blood	2 hours after meal	24 hours
GLUC-R	Random Blood Glucose	150	Biochemistry	Blood sugar anytime	Blood	No fasting required	24 hours
HbA1c	HbA1c Glycated Hemoglobin	400	Biochemistry	3-month glucose average	Blood	No fasting required	24 hours
LFT	Liver Function Test	600	Biochemistry	Liver health markers	Blood	8 hours fasting	24-48 hours
SGOT	SGOT (AST)	250	Biochemistry	Liver enzyme	Blood	8 hours fasting	24 hours
SGPT	SGPT (ALT)	250	Biochemistry	Liver enzyme	Blood	8 hours fasting	24 hours
ALP	Alkaline Phosphatase	200	Biochemistry	Liver/bone enzyme	Blood	8 hours fasting	24 hours
BILIRUBIN	Total Bilirubin	200	Biochemistry	Liver function	Blood	8 hours fasting	24 hours
KFT	Kidney Function Test	550	Biochemistry	Kidney health markers	Blood	No fasting required	24 hours
CREATININE	Serum Creatinine	200	Biochemistry	Kidney function	Blood	No fasting required	24 hours
BUN	Blood Urea Nitrogen	200	Biochemistry	Kidney function	Blood	No fasting required	24 hours
URIC-ACID	Uric Acid	200	Biochemistry	Gout/kidney screening	Blood	No fasting required	24 hours
LIPID	Lipid Profile	500	Biochemistry	Cholesterol & triglycerides	Blood	12 hours fasting	24 hours
CHOL	Total Cholesterol	200	Biochemistry	Cholesterol level	Blood	12 hours fasting	24 hours
HDL	HDL Cholesterol	200	Biochemistry	Good cholesterol	Blood	12 hours fasting	24 hours
LDL	LDL Cholesterol	200	Biochemistry	Bad cholesterol	Blood	12 hours fasting	24 hours
TG	Triglycerides	200	Biochemistry	Fat levels	Blood	12 hours fasting	24 hours
TSH	Thyroid Stimulating Hormone	300	Endocrinology	Thyroid function	Blood	No fasting required	24-48 hours
T3	T3 (Triiodothyronine)	300	Endocrinology	Thyroid hormone	Blood	No fasting required	24-48 hours
T4	T4 (Thyroxine)	300	Endocrinology	Thyroid hormone	Blood	No fasting required	24-48 hours
THYROID	Thyroid Profile	800	Endocrinology	Complete thyroid check	Blood	No fasting required	24-48 hours
URINE-R	Urine Routine	150	Pathology	Basic urine analysis	Urine	Early morning sample	24 hours
URINE-C	Urine Culture	500	Microbiology	Infection detection	Urine	Midstream clean catch	48-72 hours
STOOL-R	Stool Routine	200	Pathology	Basic stool analysis	Stool	Fresh sample	24 hours
BLOOD-C	Blood Culture	800	Microbiology	Blood infection test	Blood	Before antibiotics	48-72 hours
CRP	C-Reactive Protein	400	Immunology	Inflammation marker	Blood	No fasting required	24 hours
RA-FACTOR	Rheumatoid Factor	500	Immunology	Arthritis screening	Blood	No fasting required	24-48 hours
ANA	Antinuclear Antibody	800	Immunology	Autoimmune screening	Blood	No fasting required	48-72 hours
VITAMIN-D	Vitamin D (25-OH)	1200	Biochemistry	Vitamin D levels	Blood	No fasting required	48 hours
VITAMIN-B12	Vitamin B12	800	Biochemistry	B12 deficiency	Blood	No fasting required	48 hours
IRON	Serum Iron	300	Biochemistry	Iron levels	Blood	Fasting preferred	24 hours
FERRITIN	Serum Ferritin	500	Biochemistry	Iron stores	Blood	Fasting preferred	24-48 hours
```

---

## Instructions

1. **Open Excel** (or Google Sheets)
2. **Create a new spreadsheet**
3. **Copy the data above** including the header row
4. **Paste into Excel** starting from cell A1
5. **Add your remaining 1095 tests** following the same format
6. **Save as `.xlsx` format** (not .csv)
7. **Place the file** in your backend directory

## Important Notes

✅ **Do's:**
- First row MUST be column headers
- Test codes must be unique
- Costs should be numbers only (no ₹ or currency symbols)
- Keep data clean (no empty rows between tests)

❌ **Don'ts:**
- Don't use merged cells
- Don't include formulas
- Don't add ₹ or Rs in cost column
- Don't leave blank rows

## Column Name Variations (All Work)

The import script recognizes these variations:

- **Code**: Code, Test Code, TestCode, code
- **Test Name**: Test Name, TestName, Name, name
- **Cost**: Cost, Price, Amount, cost, price
- **Category**: Category, Type, category, type

Choose any variation that matches your Excel file!

