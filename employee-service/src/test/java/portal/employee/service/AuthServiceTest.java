package portal.employee.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import portal.dto.AuthDto;
import portal.dto.RoleCode;
import portal.dto.UserDto;
import portal.employee.repository.UserRepository;
import portal.employee.security.JwtService;
import portal.employee.security.UserPrincipal;
import portal.entity.Employee;
import portal.entity.Role;
import portal.entity.User;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    private User user;
    private Role role;
    private Employee employee;

    @BeforeEach
    void setUp() {
        role = Role.builder().id((short) 0).code(RoleCode.ADMIN).name("Администратор").build();
        employee = Employee.builder().id(100L).name("Admin User").build();
        user = User.builder()
                .id(1L)
                .login("admin")
                .passwordHash("$2a$10$hashed_admin_pass")
                .role(role)
                .employee(employee)
                .isActive(true)
                .build();
    }

    @Test
    @DisplayName("Успешный вход в систему и получение токена")
    void shouldLoginSuccessfully() {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("admin", "admin123");

        when(userRepository.findByLogin("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("admin123", "$2a$10$hashed_admin_pass")).thenReturn(true);
        when(jwtService.generateToken(1L, "admin", RoleCode.ADMIN, 100L)).thenReturn("mocked.jwt.token");

        AuthDto.AuthResponse response = authService.login(request);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("mocked.jwt.token");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
        assertThat(response.getUserId()).isEqualTo(1L);
        assertThat(response.getLogin()).isEqualTo("admin");
        assertThat(response.getRole()).isEqualTo(RoleCode.ADMIN);
        assertThat(response.getEmployeeId()).isEqualTo(100L);

        verify(userRepository).save(user);
        assertThat(user.getLastLoginAt()).isNotNull();
    }

    @Test
    @DisplayName("Ошибка логина при неверном пароле")
    void shouldThrowWhenPasswordMismatch() {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("admin", "wrong_password");

        when(userRepository.findByLogin("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong_password", "$2a$10$hashed_admin_pass")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("Неверный логин или пароль");

        verify(jwtService, never()).generateToken(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Ошибка логина если пользователь не найден")
    void shouldThrowWhenUserNotFound() {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("nonexistent", "pass");

        when(userRepository.findByLogin("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("Неверный логин или пароль");
    }

    @Test
    @DisplayName("Ошибка логина если учетная запись деактивирована")
    void shouldThrowWhenUserDeactivated() {
        user.setIsActive(false);
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("admin", "admin123");

        when(userRepository.findByLogin("admin")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("деактивирована");
    }

    @Test
    @DisplayName("Успешный вход пользователя без хэша пароля с дефолтным паролем")
    void shouldLoginUserWithoutPasswordHash() {
        user.setPasswordHash(null);
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("admin", "1234");

        when(userRepository.findByLogin("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("1234")).thenReturn("$2a$10$newly_hashed");
        when(jwtService.generateToken(1L, "admin", RoleCode.ADMIN, 100L)).thenReturn("mocked.jwt.token");

        AuthDto.AuthResponse response = authService.login(request);

        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("mocked.jwt.token");
        assertThat(user.getPasswordHash()).isEqualTo("$2a$10$newly_hashed");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("Получение профиля текущего пользователя")
    void shouldGetMeSuccessfully() {
        UserPrincipal principal = UserPrincipal.builder()
                .id(1L)
                .login("admin")
                .role(RoleCode.ADMIN)
                .employeeId(100L)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserDto.Response response = authService.getMe(principal);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getLogin()).isEqualTo("admin");
        assertThat(response.getRoleCode()).isEqualTo(RoleCode.ADMIN);
        assertThat(response.getEmployeeId()).isEqualTo(100L);
    }
}
