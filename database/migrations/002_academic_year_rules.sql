CREATE TABLE IF NOT EXISTS opportunity_academic_years (
  opportunity_id BIGINT UNSIGNED NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  PRIMARY KEY (opportunity_id, academic_year),
  INDEX idx_opp_academic_year (academic_year, opportunity_id),
  CONSTRAINT fk_opp_academic_year_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
