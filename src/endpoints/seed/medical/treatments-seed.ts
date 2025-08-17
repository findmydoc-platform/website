import { Payload } from 'payload'
import { upsertByUniqueField, textToRichText } from '../seed-helpers'

/**
 * Seed hair transplant and related treatments idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedTreatments(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding treatments (idempotent)...')

  let created = 0
  let updated = 0

  // First, get medical specialties for relationships
  const specialtyMap: Record<string, any> = {}
  const specialties = await payload.find({
    collection: 'medical-specialties',
    limit: 100,
    where: {},
  })

  for (const specialty of specialties.docs) {
    specialtyMap[specialty.name] = specialty
  }

  const treatments = [
    {
      name: 'FUE Hair Transplant',
      description:
        'Follicular unit extraction (FUE) involves harvesting individual hair follicles from a donor area using tiny punches and transplanting them to balding areas; this minimally invasive technique leaves tiny scars and gives a natural look.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'FUT Hair Transplant',
      description:
        'Follicular unit transplantation (FUT) removes a strip of scalp from the back of the head, from which hair grafts are dissected and transplanted to balding areas; it typically leaves a linear scar but allows many grafts in one session.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'DHI Hair Transplant',
      description:
        'Direct hair implantation (DHI) uses a specialized pen-like device to extract and implant hair follicles individually without creating pre-made incisions, allowing precise placement and reduced trauma.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Beard Transplant',
      description:
        'Beard transplant surgery moves hair follicles from the scalp to the beard area to create or thicken facial hair; it uses FUE or DHI techniques and ensures natural growth direction.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Eyebrow Transplant',
      description:
        'Eyebrow transplantation transfers individual hair follicles from the back of the scalp to the brows to restore density and shape; FUE or DHI techniques are used for precise placement.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Mustache Transplant',
      description:
        'A mustache transplant relocates hair follicles from donor areas to the upper lip to create or enhance a mustache; careful placement mimics natural hair growth.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Sapphire Hair Transplant',
      description:
        'This variation of FUE uses sapphire-tipped blades to create microchannels for grafts, aiming to reduce tissue trauma, speed healing and yield finer results.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'PRP Hair Treatment',
      description:
        "Platelet-rich plasma (PRP) treatment draws a patient's blood, concentrates its platelets and growth factors, then injects it into the scalp to stimulate hair follicle function and promote hair growth.",
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    // Canonical cross-specialty treatments
    {
      name: 'Rhinoplasty',
      description:
        'Surgical reshaping of the nose to improve aesthetics and function; commonly performed within cosmetic/plastic surgery.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Facelift',
      description:
        'A facelift (rhytidectomy) lifts and repositions sagging facial tissues and tightens muscles; modern techniques also add fat to restore volume and achieve a natural, youthful look.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Breast Lift',
      description:
        'A breast lift (mastopexy) removes excess skin and tightens breast tissue to raise and reshape sagging breasts; it may correct asymmetry but does not change breast size unless combined with implants.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Liposuction',
      description:
        'Liposuction removes fat from targeted areas (abdomen, hips, thighs, arms, neck) using suction; it contours body shape but is not intended for weight loss.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Tummy Tuck',
      description:
        'A tummy tuck (abdominoplasty) removes excess abdominal skin and fat and tightens weakened muscles to address sagging and bulging, creating a flatter, firmer abdomen.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Blepharoplasty',
      description:
        'Blepharoplasty (eyelid surgery) removes excess skin, fat or muscle from the upper or lower eyelids to reduce puffiness, improve vision and restore a more youthful eye appearance.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Breast Implants',
      description:
        'Breast augmentation involves inserting silicone or saline implants to enlarge or restore breast size and shape for cosmetic enhancement or after mastectomy.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Butt Implants',
      description:
        'Butt implants insert silicone devices into or below the gluteal muscles to create a rounder, fuller buttock; results are permanent but carry risks.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Brazilian Butt Lift',
      description:
        'A Brazilian butt lift transfers fat removed by liposuction from other body parts to the buttocks to enhance shape and volume without implants.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Body Lift',
      description:
        'A body lift (lower body lift) removes loose skin and fat around the waist and buttocks to create a firmer, smoother contour, often after significant weight loss.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Arm Lift',
      description:
        'An arm lift (brachioplasty) removes excess skin and fat from the upper arms to improve tone and contour.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Chin Implant',
      description:
        'A chin implant procedure places a flexible implant onto the chin bone to enhance definition and correct a recessed or weak chin.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Fat Transfer',
      description:
        'Fat transfer (autologous fat grafting) harvests fat with liposuction and injects it into areas like the face, breasts or buttocks to restore or add volume.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Gynecomastia Surgery',
      description:
        'Gynecomastia surgery removes excess male breast tissue through liposuction or excision to achieve a flatter, more masculine chest.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Neck Lift',
      description:
        'A neck lift removes excess fat and sagging skin and tightens the platysma muscle to create a more defined jawline and youthful neck.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Brow Lift',
      description:
        'A brow (forehead) lift repositions sagging eyebrows and smooths forehead wrinkles and frown lines, giving a more youthful appearance.',
      medicalSpecialtyName: 'Cosmetic / Plastic Surgery',
    },
    {
      name: 'Dental Implants',
      description:
        'Surgical placement of artificial tooth roots (implants) to support crowns, bridges, or dentures; restores function and aesthetics.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Dental Veneers',
      description:
        'Veneers are thin, custom-made shells of porcelain or composite resin bonded to the front of teeth to conceal chips, stains or gaps and create a brighter smile.',
      medicalSpecialtyName: 'Cosmetic Dentists',
    },
    {
      name: 'Dental Bridge',
      description:
        'A dental bridge replaces one or more missing teeth by anchoring artificial teeth to adjacent natural teeth or implants using crowns.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'All-on-4 Dental Implants',
      description:
        'All-on-4 uses four strategically placed implants to support a full arch of fixed replacement teeth, offering a stable alternative to removable dentures.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Bone Graft',
      description:
        'Dental bone grafting adds or rebuilds bone in the jaw to provide enough support for implants; it may use your own bone, donated bone or synthetic material.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Tooth Filling',
      description:
        'Tooth fillings remove decayed tooth material and fill the cavity with composite resin, amalgam or other material to restore shape and function and prevent further decay.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Teeth Whitening',
      description:
        'Teeth whitening uses peroxide-based bleaching agents to lighten tooth color and remove stains; treatments are performed at home or professionally.',
      medicalSpecialtyName: 'Cosmetic Dentists',
    },
    {
      name: 'Sinus Lift',
      description:
        'A sinus lift adds bone below the sinus floor in the upper jaw by gently lifting the sinus membrane to allow placement of dental implants in the back teeth area.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Hollywood Smile',
      description:
        'A Hollywood smile makeover combines procedures like veneers, crowns and whitening to achieve a uniform, bright and aesthetically pleasing smile.',
      medicalSpecialtyName: 'Cosmetic Dentists',
    },
    {
      name: 'Root Canal Treatment',
      description:
        'A root canal removes infected or damaged pulp from a tooth, cleans the root canals and seals them to save the tooth, usually followed by a crown.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Teeth Cleaning',
      description:
        'Professional teeth cleaning by a dentist or hygienist removes plaque and tartar, polishes teeth and may include fluoride application to prevent cavities.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'Dental Crowns',
      description:
        'A dental crown is a tooth-shaped cap placed over a damaged or decayed tooth to restore its size, strength and appearance, fully encasing the visible portion.',
      medicalSpecialtyName: 'Dental Treatment / Dentistry',
    },
    {
      name: 'IVF (In Vitro Fertilization)',
      description:
        'Assisted reproductive technology where eggs are fertilized by sperm in a lab and transferred to the uterus to achieve pregnancy.',
      medicalSpecialtyName: 'Obstetrics & Gynecology',
    },
    {
      name: 'Vasectomy',
      description:
        'Vasectomy is a minor surgical procedure that cuts or seals the vas deferens to prevent sperm from entering semen, providing permanent male contraception.',
      medicalSpecialtyName: 'Urology',
    },
    {
      name: 'Vasectomy Reversal',
      description:
        'Vasectomy reversal reconnects the severed vas deferens using microsurgery to restore sperm flow to the semen; success depends on time since vasectomy.',
      medicalSpecialtyName: 'Urology',
    },
    {
      name: 'Tubal Ligation',
      description:
        'Tubal ligation permanently blocks or seals the fallopian tubes to prevent eggs from reaching the uterus, serving as permanent female birth control.',
      medicalSpecialtyName: 'Obstetrics & Gynecology',
    },
    {
      name: 'Egg Freezing',
      description:
        'Egg freezing involves harvesting a woman’s eggs, freezing them unfertilized and storing them for future use, preserving fertility for medical or personal reasons.',
      medicalSpecialtyName: 'Fertility Clinics',
    },
    {
      name: 'LASIK',
      description:
        'Laser refractive eye surgery to correct vision by reshaping the cornea, reducing dependence on glasses or contact lenses.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    {
      name: 'Cataract Surgery',
      description:
        'Cataract surgery removes a cloudy eye lens and replaces it with a clear artificial intraocular lens to restore vision, typically performed under local anesthesia.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    {
      name: 'PRK Eye Surgery',
      description:
        'Photorefractive keratectomy (PRK) uses an excimer laser to remove the cornea’s surface layer and reshape underlying tissue to correct vision, suitable for thinner corneas.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    {
      name: 'SMILE Eye Surgery',
      description:
        'Small Incision Lenticule Extraction (SMILE) uses a femtosecond laser to create a thin disc of tissue within the cornea, which is removed through a small incision to correct myopia and astigmatism.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    {
      name: 'Corneal Transplant',
      description:
        'A corneal transplant (keratoplasty) replaces diseased or scarred corneal tissue with healthy donor tissue to improve vision and relieve pain.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    {
      name: 'Strabismus Surgery',
      description:
        'Strabismus surgery adjusts the position or tension of eye muscles to correct misaligned eyes and improve binocular vision and eye coordination.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    {
      name: 'Artificial Corneal Transplant',
      description:
        'A keratoprosthesis implants an artificial cornea when conventional transplants fail or are unsuitable, restoring vision in severe corneal disease.',
      medicalSpecialtyName: 'Ophthalmology',
    },
    // Bariatric & metabolic procedures
    {
      name: 'Gastric Bypass Surgery',
      description:
        'Gastric bypass surgery reduces stomach size and reroutes the small intestine to limit how much food you can eat and how many nutrients you absorb, promoting major weight loss.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Gastric Sleeve Surgery',
      description:
        'Gastric sleeve (sleeve gastrectomy) removes about 80% of the stomach, leaving a narrow tube to restrict food intake and decrease hunger hormones, leading to significant weight loss.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Gastric Band Surgery',
      description:
        'Gastric band (Lap-band) surgery places an adjustable silicone band around the upper stomach to create a small pouch, limiting food intake; it’s reversible and offers moderate weight loss.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Gastric Balloon',
      description:
        'An intragastric balloon is a nonsurgical, temporary device placed endoscopically into the stomach and filled with saline to occupy space so you feel full sooner and eat less.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Endoscopic Sleeve Gastroplasty',
      description:
        'Endoscopic sleeve gastroplasty (ESG) uses an endoscope and suturing device to reduce stomach volume by creating a sleeve; it’s minimally invasive and lowers food intake.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Gastric Band Revision',
      description:
        'A gastric band revision or adjustment corrects issues or insufficient weight loss after a gastric band procedure by tightening, loosening or converting to another bariatric surgery.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Diabetes Surgery',
      description:
        'Metabolic surgery for type 2 diabetes modifies stomach and intestinal anatomy to improve blood sugar control, often through sleeve gastrectomy or bypass methods.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Laparoscopic Ileal Interposition',
      description:
        'This experimental metabolic procedure moves a section of the ileum closer to the stomach to enhance hormone secretion and improve type 2 diabetes control.',
      medicalSpecialtyName: 'Bariatric Surgery',
    },
    {
      name: 'Floppy Nissen Fundoplication',
      description:
        'A floppy Nissen fundoplication treats acid reflux by loosely wrapping the top of the stomach around the lower esophagus, strengthening the lower esophageal sphincter to prevent reflux.',
      medicalSpecialtyName: 'General Surgery',
    },
    // Oncology
    {
      name: 'Stomach Cancer Treatment',
      description:
        'Stomach (gastric) cancer is treated with surgery to remove tumors, often combined with chemotherapy, radiation therapy and targeted drugs depending on the stage.',
      medicalSpecialtyName: 'Hematology Oncology',
    },
    {
      name: 'Lung Cancer Treatment',
      description:
        'Lung cancer treatment depends on the type and stage and may include surgical resection, chemotherapy, radiation therapy, targeted therapy or immunotherapy.',
      medicalSpecialtyName: 'Hematology Oncology',
    },
    {
      name: 'Liver Cancer Treatment',
      description:
        'Liver cancer treatment may involve surgical resection or transplantation, ablation or embolization to destroy tumors, and targeted or immunotherapy drugs.',
      medicalSpecialtyName: 'Hematology Oncology',
    },
    {
      name: 'Breast Cancer Treatment',
      description:
        'Breast cancer care typically involves surgery (lumpectomy or mastectomy), possibly followed by chemotherapy, radiation therapy, hormone therapy or targeted therapy to reduce recurrence.',
      medicalSpecialtyName: 'Hematology Oncology',
    },
    {
      name: 'Pancreatic Cancer Treatment',
      description:
        'Pancreatic cancer is aggressive; options include surgery (such as the Whipple procedure), chemotherapy, radiation therapy and sometimes targeted or immunotherapy.',
      medicalSpecialtyName: 'Hematology Oncology',
    },
    {
      name: 'Prostate Cancer Treatment',
      description:
        'Prostate cancer may be treated with active surveillance, surgery to remove the prostate, radiation therapy, hormone therapy, chemotherapy or newer targeted therapies depending on severity.',
      medicalSpecialtyName: 'Hematology Oncology',
    },
    // Medical Aesthetics
    {
      name: 'Laser Hair Removal',
      description:
        'Laser hair removal uses concentrated light to heat and destroy pigment-rich hair follicles, reducing unwanted hair growth; multiple sessions are needed for long-term results.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Microneedling',
      description:
        'Microneedling uses tiny needles to create micro-injuries that stimulate the skin’s natural healing, boosting collagen production and improving texture, scars and fine lines.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Mole Removal',
      description:
        'Mole removal excises or lasers off moles for medical reasons or aesthetic preference; the removed tissue may be biopsied to check for cancer.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Tattoo Removal',
      description:
        'Tattoo removal uses lasers that break down ink particles in the skin so they can be absorbed and eliminated by the body; several treatments are needed for fading.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Chemical Peel',
      description:
        'Chemical peels apply acid solutions to exfoliate the outer skin layer, improving tone and texture and treating discoloration or fine lines; depth varies from superficial to deep.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Ultherapy',
      description:
        'Ultherapy delivers focused ultrasound energy to stimulate collagen production and tighten skin on the face, neck and décolletage without surgery.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Dermal Fillers',
      description:
        'Dermal fillers are injectable gels (often hyaluronic acid) used to restore volume, smooth wrinkles and enhance facial features; results are temporary and vary by product.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Sclerotherapy',
      description:
        'Sclerotherapy treats varicose and spider veins by injecting a solution that irritates and shrinks the vessel, causing it to collapse and fade from view.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Cryolipolysis',
      description:
        'Cryolipolysis (CoolSculpting) freezes fat cells to break them down without harming surrounding tissue; the body gradually eliminates the destroyed fat cells.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Fractional CO2 Laser',
      description:
        'Fractional CO2 laser resurfacing creates microscopic columns of treated skin to stimulate collagen production and remove damaged skin, reducing scars, wrinkles and uneven texture.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'HIFU',
      description:
        'High-intensity focused ultrasound (HIFU) delivers focused ultrasound energy deep beneath the skin to generate heat and stimulate collagen for non-surgical skin lifting and tightening.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'HydraFacial',
      description:
        'HydraFacial combines cleansing, exfoliation, pore extraction and serum infusion in a single treatment to hydrate and rejuvenate skin without downtime.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'LipoDissolve',
      description:
        'LipoDissolve (injection lipolysis) injects substances like deoxycholic acid to break down small pockets of fat in areas such as the chin or stomach; results vary.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Mesotherapy',
      description:
        'Mesotherapy delivers vitamins, enzymes, hormones or other medications into the middle layer of skin to rejuvenate and tighten skin or target small fat deposits.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Radiofrequency Ablation of Varicose Veins',
      description:
        'Radiofrequency ablation treats varicose veins by threading a catheter into the vein and applying heat to seal it closed, allowing blood to reroute to healthy veins.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'Scar Removal',
      description:
        'Scar removal involves techniques like laser resurfacing, surgical excision or dermabrasion to reduce the appearance of scars and improve skin texture.',
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
    {
      name: 'PRP Skin Rejuvenation',
      description:
        "Platelet-rich plasma (PRP) skin rejuvenation injects a concentration of a patient’s own platelets into the skin to stimulate collagen production and improve tone and texture.",
      medicalSpecialtyName: 'Medical Aesthetics / Beauty Clinics',
    },
  ]

  for (const treatment of treatments) {
    const specialty = specialtyMap[treatment.medicalSpecialtyName]
    if (!specialty) {
      payload.logger.warn(
        `Medical specialty '${treatment.medicalSpecialtyName}' not found for treatment '${treatment.name}'. Ensure specialties are seeded first.`,
      )
      continue
    }

    const res = await upsertByUniqueField(payload, 'treatments', 'name', {
      name: treatment.name,
      description: textToRichText(treatment.description),
      medicalSpecialty: specialty.id,
    })
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding treatments.')
  return { created, updated }
}
