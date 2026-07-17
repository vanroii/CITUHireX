-- ============================================================================
-- CITUHireX — Migration 0021
-- Standardized, program-linked skills taxonomy. Replaces free-text skill
-- entry with a curated checkbox list scoped to each CEA program — used by
-- Company job postings (union of skills across selected programs, each
-- labeled with which program(s) it belongs to) and Student profiles
-- (scoped to just their own program).
-- ============================================================================

create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table program_skills (
  program_id uuid not null references programs(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  primary key (program_id, skill_id)
);

comment on table skills is 'Master list of standardized skill names, deduplicated across programs (e.g. AutoCAD is one row shared by several programs).';
comment on table program_skills is 'Many-to-many: which skills are standard for which CEA program.';

alter table skills enable row level security;
alter table program_skills enable row level security;

create policy "skills: read all" on skills for select using (true);
create policy "program_skills: read all" on program_skills for select using (true);

insert into skills (name) values
  ('Programming (C/C++)'), ('Python'), ('Java'), ('Embedded Systems'), ('Microcontrollers (Arduino/PIC)'),
  ('Digital Logic Design'), ('Computer Networks'), ('Database Management (SQL)'), ('Web Development'),
  ('Circuit Design'), ('PCB Design'), ('Linux/Unix Systems'), ('Data Structures & Algorithms'),
  ('IoT Development'), ('VHDL/Verilog'),
  ('AutoCAD'), ('Structural Analysis'), ('Surveying'), ('Construction Management'), ('SketchUp'),
  ('STAAD Pro'), ('Concrete Design'), ('Geotechnical Engineering'), ('Project Estimation'),
  ('Quantity Surveying'), ('Site Supervision'), ('Building Codes & Standards'), ('Hydraulics'),
  ('Land Development'),
  ('Circuit Analysis'), ('Power Systems'), ('Electrical Design'), ('AutoCAD Electrical'),
  ('PLC Programming'), ('Motor Controls'), ('Electrical Safety Standards'), ('Renewable Energy Systems'),
  ('Power Distribution'), ('Instrumentation'), ('MATLAB'), ('Transformer Design'),
  ('Signal Processing'), ('Telecommunications'), ('RF Design'), ('Soldering & Assembly'),
  ('Testing & Troubleshooting'),
  ('SolidWorks'), ('Finite Element Analysis (FEA)'), ('Thermodynamics Analysis'), ('CFD Simulation'),
  ('3D Modeling'), ('Python for Engineering'), ('Machine Design'), ('HVAC Systems'),
  ('Manufacturing Processes'),
  ('Robotics'), ('Sensors & Actuators'), ('Automation Systems'), ('CNC Machining'), ('3D Printing'),
  ('Mine Surveying'), ('Rock Mechanics'), ('Mineral Processing'), ('Mine Planning & Design'),
  ('Blasting Operations'), ('Geological Mapping'), ('Mine Safety Standards'), ('Ore Sampling'),
  ('Environmental Compliance'),
  ('Revit'), ('Architectural Rendering'), ('Space Planning'), ('Construction Documentation'),
  ('Sustainable Design'), ('Urban Planning Basics'), ('Adobe Photoshop/Illustrator'), ('Model Making'),
  ('Process Simulation (Aspen)'), ('Chemical Process Design'), ('Mass & Energy Balance'),
  ('Lab Techniques & Analysis'), ('Quality Control'), ('Plant Operations'), ('Process Instrumentation'),
  ('Material Science'),
  ('Process Improvement (Lean/Six Sigma)'), ('Time & Motion Study'), ('Supply Chain Management'),
  ('Production Planning'), ('Data Analysis (Excel/Minitab)'), ('Ergonomics'), ('Statistical Analysis'),
  ('Project Management'), ('Inventory Management'), ('ERP Systems'),
  ('Semiconductor Fabrication'), ('Equipment Maintenance'), ('Cleanroom Protocols'),
  ('Statistical Process Control'), ('Lean Manufacturing'), ('PCB Assembly')
on conflict (name) do nothing;

insert into program_skills (program_id, skill_id)
select p.id, s.id from (values
  ('BSCPE','Programming (C/C++)'), ('BSCPE','Python'), ('BSCPE','Java'), ('BSCPE','Embedded Systems'),
  ('BSCPE','Microcontrollers (Arduino/PIC)'), ('BSCPE','Digital Logic Design'), ('BSCPE','Computer Networks'),
  ('BSCPE','Database Management (SQL)'), ('BSCPE','Web Development'), ('BSCPE','Circuit Design'),
  ('BSCPE','PCB Design'), ('BSCPE','Linux/Unix Systems'), ('BSCPE','Data Structures & Algorithms'),
  ('BSCPE','IoT Development'), ('BSCPE','VHDL/Verilog'),
  ('BSCE','AutoCAD'), ('BSCE','Structural Analysis'), ('BSCE','Surveying'), ('BSCE','Construction Management'),
  ('BSCE','SketchUp'), ('BSCE','STAAD Pro'), ('BSCE','Concrete Design'), ('BSCE','Geotechnical Engineering'),
  ('BSCE','Project Estimation'), ('BSCE','Quantity Surveying'), ('BSCE','Site Supervision'),
  ('BSCE','Building Codes & Standards'), ('BSCE','Hydraulics'), ('BSCE','Land Development'),
  ('BSEE','Circuit Analysis'), ('BSEE','Power Systems'), ('BSEE','Electrical Design'),
  ('BSEE','AutoCAD Electrical'), ('BSEE','PLC Programming'), ('BSEE','Motor Controls'),
  ('BSEE','Electrical Safety Standards'), ('BSEE','Renewable Energy Systems'), ('BSEE','Power Distribution'),
  ('BSEE','Instrumentation'), ('BSEE','MATLAB'), ('BSEE','Transformer Design'),
  ('BSECE','Circuit Design'), ('BSECE','PCB Design'), ('BSECE','Microcontrollers (Arduino/PIC)'),
  ('BSECE','Signal Processing'), ('BSECE','Telecommunications'), ('BSECE','RF Design'),
  ('BSECE','Embedded Systems'), ('BSECE','VHDL/Verilog'), ('BSECE','Digital Logic Design'),
  ('BSECE','Soldering & Assembly'), ('BSECE','Testing & Troubleshooting'), ('BSECE','IoT Development'),
  ('BSME-CS','SolidWorks'), ('BSME-CS','AutoCAD'), ('BSME-CS','MATLAB'),
  ('BSME-CS','Finite Element Analysis (FEA)'), ('BSME-CS','Thermodynamics Analysis'),
  ('BSME-CS','CFD Simulation'), ('BSME-CS','3D Modeling'), ('BSME-CS','Python for Engineering'),
  ('BSME-CS','Machine Design'), ('BSME-CS','HVAC Systems'), ('BSME-CS','Manufacturing Processes'),
  ('BSME-MT','SolidWorks'), ('BSME-MT','AutoCAD'), ('BSME-MT','PLC Programming'), ('BSME-MT','Robotics'),
  ('BSME-MT','Microcontrollers (Arduino/PIC)'), ('BSME-MT','Sensors & Actuators'),
  ('BSME-MT','Automation Systems'), ('BSME-MT','CNC Machining'), ('BSME-MT','Machine Design'),
  ('BSME-MT','Manufacturing Processes'), ('BSME-MT','3D Printing'),
  ('BSMinE','Mine Surveying'), ('BSMinE','Rock Mechanics'), ('BSMinE','Mineral Processing'),
  ('BSMinE','AutoCAD'), ('BSMinE','Mine Planning & Design'), ('BSMinE','Blasting Operations'),
  ('BSMinE','Geological Mapping'), ('BSMinE','Mine Safety Standards'), ('BSMinE','Ore Sampling'),
  ('BSMinE','Environmental Compliance'),
  ('BSARCH','AutoCAD'), ('BSARCH','SketchUp'), ('BSARCH','Revit'), ('BSARCH','3D Modeling'),
  ('BSARCH','Building Codes & Standards'), ('BSARCH','Architectural Rendering'), ('BSARCH','Space Planning'),
  ('BSARCH','Construction Documentation'), ('BSARCH','Sustainable Design'), ('BSARCH','Urban Planning Basics'),
  ('BSARCH','Adobe Photoshop/Illustrator'), ('BSARCH','Model Making'),
  ('BSCHE','Process Simulation (Aspen)'), ('BSCHE','Chemical Process Design'), ('BSCHE','Mass & Energy Balance'),
  ('BSCHE','Lab Techniques & Analysis'), ('BSCHE','Quality Control'), ('BSCHE','Plant Operations'),
  ('BSCHE','Environmental Compliance'), ('BSCHE','Process Instrumentation'), ('BSCHE','Material Science'),
  ('BSCHE','Thermodynamics Analysis'),
  ('BSIE','Process Improvement (Lean/Six Sigma)'), ('BSIE','Quality Control'), ('BSIE','Time & Motion Study'),
  ('BSIE','Supply Chain Management'), ('BSIE','Production Planning'), ('BSIE','Data Analysis (Excel/Minitab)'),
  ('BSIE','Ergonomics'), ('BSIE','Statistical Analysis'), ('BSIE','Project Management'),
  ('BSIE','Inventory Management'), ('BSIE','ERP Systems'),
  ('DMST','Semiconductor Fabrication'), ('DMST','Quality Control'), ('DMST','Manufacturing Processes'),
  ('DMST','Equipment Maintenance'), ('DMST','Cleanroom Protocols'), ('DMST','Testing & Troubleshooting'),
  ('DMST','Statistical Process Control'), ('DMST','Lean Manufacturing'), ('DMST','PCB Assembly'),
  ('DMST','Soldering & Assembly')
) as m(program_code, skill_name)
join programs p on p.code = m.program_code
join skills s on s.name = m.skill_name
on conflict do nothing;
