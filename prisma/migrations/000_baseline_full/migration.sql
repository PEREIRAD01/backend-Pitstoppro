-- Baseline no-op to satisfy shadow DB apply
CREATE TABLE `_prisma_baseline` (id INT NOT NULL PRIMARY KEY);
DROP TABLE `_prisma_baseline`;
