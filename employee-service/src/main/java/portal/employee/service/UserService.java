package portal.employee.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import portal.dto.UserDto;
import portal.entity.Employee;
import portal.entity.Role;
import portal.entity.User;
import portal.employee.exception.BusinessConflictException;
import portal.employee.exception.ResourceNotFoundException;
import portal.employee.repository.RoleRepository;
import portal.employee.repository.UserRepository;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final EmployeeService employeeService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserDto.Response> getAll() {
        return userRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserDto.Response getById(Long id) {
        return toResponse(userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь с ID " + id + " не найден")));
    }

    @Transactional(readOnly = true)
    public UserDto.Response getByLogin(String login) {
        return toResponse(userRepository.findByLogin(login)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь с логином '" + login + "' не найден")));
    }

    @Transactional(readOnly = true)
    public UserDto.Response getByEmployeeId(Long employeeId) {
        return toResponse(userRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("У сотрудника с ID " + employeeId + " нет учетной записи")));
    }

    @Transactional(readOnly = true)
    public List<UserDto.RoleResponse> getRoles() {
        return roleRepository.findAll().stream()
                .map(r -> UserDto.RoleResponse.builder()
                        .id(r.getId())
                        .code(r.getCode())
                        .name(r.getName())
                        .description(r.getDescription())
                        .build())
                .toList();
    }

    @Transactional
    public UserDto.Response create(UserDto.Request request) {
        String login = request.getLogin().trim();
        if (userRepository.existsByLogin(login)) {
            throw new BusinessConflictException("Логин '" + login + "' уже занят другим сотрудником");
        }

        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new ResourceNotFoundException("Роль с ID " + request.getRoleId() + " не существует (допустимо: 0 - ADMIN, 1 - HR, 2 - MANAGER, 3 - EMPLOYEE)"));

        Employee employee = null;
        if (request.getEmployeeId() != null) {
            employee = employeeService.findEmployeeById(request.getEmployeeId());
            if (userRepository.findByEmployeeId(employee.getId()).isPresent()) {
                throw new BusinessConflictException("Сотрудник '" + employee.getName() + "' уже имеет учетную запись");
            }
        }

        String rawPassword = (request.getPassword() != null && !request.getPassword().isBlank())
                ? request.getPassword().trim()
                : "1234";

        User user = User.builder()
                .login(login)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(role)
                .employee(employee)
                .isActive(true)
                .build();

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public UserDto.Response update(Long id, UserDto.Request request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь с ID " + id + " не найден"));

        String login = request.getLogin().trim();
        if (!user.getLogin().equalsIgnoreCase(login) && userRepository.existsByLogin(login)) {
            throw new BusinessConflictException("Логин '" + login + "' уже занят другим сотрудником");
        }

        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new ResourceNotFoundException("Роль с ID " + request.getRoleId() + " не существует (допустимо: 0 - ADMIN, 1 - HR, 2 - MANAGER, 3 - EMPLOYEE)"));

        Employee employee = null;
        if (request.getEmployeeId() != null) {
            employee = employeeService.findEmployeeById(request.getEmployeeId());
            Optional<User> existing = userRepository.findByEmployeeId(employee.getId());
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                throw new BusinessConflictException("Сотрудник '" + employee.getName() + "' уже привязан к пользователю '" + existing.get().getLogin() + "'");
            }
        }

        user.setLogin(login);
        user.setRole(role);
        user.setEmployee(employee);

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword().trim()));
        }

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void delete(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь с ID " + id + " не найден"));
        userRepository.delete(user);
    }

    private UserDto.Response toResponse(User user) {
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
