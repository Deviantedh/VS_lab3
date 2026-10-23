package portal.employee.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import portal.dto.AuthDto;
import portal.dto.RoleCode;
import portal.dto.UserDto;
import portal.entity.User;
import portal.employee.exception.ResourceNotFoundException;
import portal.employee.repository.UserRepository;
import portal.employee.security.JwtService;
import portal.employee.security.UserPrincipal;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthDto.AuthResponse login(AuthDto.LoginRequest request) {
        String login = request.getLogin().trim();
        User user = userRepository.findByLogin(login)
                .orElseThrow(() -> new BadCredentialsException("Неверный логин или пароль"));

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new BadCredentialsException("Учётная запись деактивирована");
        }

        if (user.getPasswordHash() == null) {
            String defaultExpected = "1234";
            if (!defaultExpected.equals(request.getPassword())) {
                throw new BadCredentialsException("Неверный логин или пароль");
            }
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        } else {
            if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
                throw new BadCredentialsException("Неверный логин или пароль");
            }
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        RoleCode roleCode = user.getRole() != null ? user.getRole().getCode() : RoleCode.EMPLOYEE;
        Long employeeId = user.getEmployee() != null ? user.getEmployee().getId() : null;

        String token = jwtService.generateToken(user.getId(), user.getLogin(), roleCode, employeeId);

        return AuthDto.AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .userId(user.getId())
                .login(user.getLogin())
                .role(roleCode)
                .employeeId(employeeId)
                .build();
    }

    @Transactional(readOnly = true)
    public UserDto.Response getMe(UserPrincipal principal) {
        if (principal == null || principal.getId() == null) {
            throw new BadCredentialsException("Пользователь не авторизован");
        }
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        return UserDto.Response.builder()
                .id(user.getId())
                .employeeId(user.getEmployee() != null ? user.getEmployee().getId() : null)
                .employeeName(user.getEmployee() != null ? user.getEmployee().getName() : null)
                .roleId(user.getRole().getId())
                .roleCode(user.getRole().getCode())
                .roleName(user.getRole().getName())
                .login(user.getLogin())
                .isActive(user.getIsActive())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
