CREATE TABLE IF NOT EXISTS opportunity_test_recommendations (
  opportunity_id BIGINT UNSIGNED NOT NULL,
  test_id BIGINT UNSIGNED NOT NULL,
  recommendation_note VARCHAR(255) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (opportunity_id, test_id),
  INDEX idx_opportunity_test_recommendation_order (opportunity_id, sort_order),
  CONSTRAINT fk_opp_test_rec_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  CONSTRAINT fk_opp_test_rec_test FOREIGN KEY (test_id) REFERENCES mock_tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS roadmap_topic_practice_tests (
  topic_id BIGINT UNSIGNED NOT NULL,
  test_id BIGINT UNSIGNED NOT NULL,
  practice_note VARCHAR(255) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (topic_id, test_id),
  INDEX idx_roadmap_topic_practice_order (topic_id, sort_order),
  CONSTRAINT fk_topic_practice_topic FOREIGN KEY (topic_id) REFERENCES roadmap_topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_topic_practice_test FOREIGN KEY (test_id) REFERENCES mock_tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
