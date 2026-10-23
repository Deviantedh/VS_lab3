-- ===================================================================
-- V3__set_default_passwords.sql
-- Установка начальных хэшей паролей (BCrypt) для пользователей:
-- Пароль по умолчанию для всех демо-пользователей: '1234'
-- ===================================================================

UPDATE users
SET password_hash = '$2a$10$jaqwfBceBD3rB8K2S/.8M.hlaDWlUDe/ZhC4d4RANQpCsE5vEVk6y'
WHERE password_hash IS NULL 
   OR password_hash = '$2a$10$NKRdBGeNVMA3bSBCPWDUruunyfdT6uvdeZqBd0C6LwrPNixLElGEW'
   OR password_hash = '$2a$10$rRn4ru9rfj0tAPzuxEf4quf1f5F0BHjxyGn7YNEFe4FqJDPdKlbQC';
