-- Initialize application database and non-root user
CREATE DATABASE IF NOT EXISTS `par_system`;
CREATE USER IF NOT EXISTS 'paruser'@'%' IDENTIFIED BY 'HAhamed03@';
GRANT ALL PRIVILEGES ON `par_system`.* TO 'paruser'@'%';
FLUSH PRIVILEGES;
