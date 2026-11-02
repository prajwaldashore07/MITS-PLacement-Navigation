CREATE TABLE IF NOT EXISTS student_academic_facts (
  student_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  active_backlogs TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_academic_facts_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS opportunity_eligibility_rules (
  opportunity_id BIGINT UNSIGNED NOT NULL,
  rule_key ENUM('max_active_backlogs') NOT NULL,
  rule_value TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (opportunity_id, rule_key),
  CONSTRAINT fk_opp_rule_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO skills (name,category,description) VALUES ('Node.js','Programming','Server-side JavaScript runtime fundamentals.');

INSERT IGNORE INTO skill_domains (skill_id,domain_id)
SELECT s.id,d.id FROM skills s JOIN domains d ON d.code IN ('SDE','WEB') WHERE s.name='Node.js';

INSERT IGNORE INTO opportunity_skill_requirements (opportunity_id,skill_id,min_rating,requirement_type)
SELECT o.id,s.id,3,'preferred' FROM opportunities o JOIN companies c ON c.id=o.company_id JOIN skills s ON s.name='Node.js' WHERE c.name='Evergreen Apps' AND o.title='Full-Stack Developer';

INSERT IGNORE INTO opportunity_eligibility_rules (opportunity_id,rule_key,rule_value)
SELECT o.id,'max_active_backlogs',CASE c.name
  WHEN 'Northstar Logic' THEN 0
  WHEN 'Bluepeak Digital' THEN 1
  WHEN 'Orbit Forge' THEN 0
  WHEN 'MapleStack' THEN 1
  WHEN 'Amberline Insights' THEN 0
  WHEN 'Meridian AI' THEN 1
  WHEN 'Lattice Cloud' THEN 0
  WHEN 'Pinecone Dataworks' THEN 1
  ELSE 0 END
FROM opportunities o JOIN companies c ON c.id=o.company_id
WHERE c.name IN ('Northstar Logic','Bluepeak Digital','Orbit Forge','MapleStack','Amberline Insights','Meridian AI','Lattice Cloud','Pinecone Dataworks');
