package portal.employee.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import portal.dto.*;
import portal.employee.repository.RoleRepository;
import portal.employee.service.EmployeeService;
import portal.employee.service.UserService;

import java.time.LocalDate;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = portal.employee.EmployeeServiceApplication.class, properties = {
        "spring.autoconfigure.exclude=" +
                "org.springframework.boot.r2dbc.autoconfigure.R2dbcAutoConfiguration," +
                "org.springframework.boot.r2dbc.autoconfigure.R2dbcInitializationAutoConfiguration," +
                "org.springframework.boot.r2dbc.autoconfigure.R2dbcProxyAutoConfiguration," +
                "org.springframework.boot.r2dbc.autoconfigure.R2dbcTransactionManagerAutoConfiguration," +
                "org.springframework.boot.data.r2dbc.autoconfigure.DataR2dbcAutoConfiguration," +
                "org.springframework.boot.data.r2dbc.autoconfigure.DataR2dbcRepositoriesAutoConfiguration," +
                "org.springframework.boot.autoconfigure.r2dbc.R2dbcAutoConfiguration," +
                "org.springframework.boot.autoconfigure.data.r2dbc.R2dbcDataAutoConfiguration," +
                "org.springframework.boot.autoconfigure.data.r2dbc.R2dbcRepositoriesAutoConfiguration," +
                "org.springframework.boot.autoconfigure.r2dbc.R2dbcTransactionManagerAutoConfiguration"
})
@ActiveProfiles("test")
@Transactional
class SpringSecurityMockMvcIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtService jwtService;

    private Long employee1Id;
    private Long employee2Id;
    private Long userEmpId;
    private Long userAdminId;

    private String employeeToken;
    private String adminToken;
    private String managerToken;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();

        if (roleRepository.count() == 0) {
            roleRepository.save(portal.entity.Role.builder().id((short) 0).code(RoleCode.ADMIN).name("Администратор").build());
            roleRepository.save(portal.entity.Role.builder().id((short) 1).code(RoleCode.HR).name("HR").build());
            roleRepository.save(portal.entity.Role.builder().id((short) 2).code(RoleCode.MANAGER).name("Управляющий").build());
            roleRepository.save(portal.entity.Role.builder().id((short) 3).code(RoleCode.EMPLOYEE).name("Сотрудник").build());
        }

        EmployeeDto.Response emp1 = employeeService.create(EmployeeDto.Request.builder()
                .name("Пекарёв Пекарь")
                .phone("+79991112233")
                .hireDate(LocalDate.now())
                .build());
        employee1Id = emp1.getId();

        EmployeeDto.Response emp2 = employeeService.create(EmployeeDto.Request.builder()
                .name("Иван Иванов")
                .phone("+79998889900")
                .hireDate(LocalDate.now())
                .build());
        employee2Id = emp2.getId();

        UserDto.Response uEmp = userService.create(UserDto.Request.builder()
                .login("pekarev_sec_test")
                .password("1234")
                .roleId((short) 3)
                .employeeId(employee1Id)
                .build());
        userEmpId = uEmp.getId();

        UserDto.Response uAdmin = userService.create(UserDto.Request.builder()
                .login("admin_sec_test")
                .password("1234")
                .roleId((short) 0)
                .employeeId(employee2Id)
                .build());
        userAdminId = uAdmin.getId();

        employeeToken = jwtService.generateToken(userEmpId, "pekarev_sec_test", RoleCode.EMPLOYEE, employee1Id);
        adminToken = jwtService.generateToken(userAdminId, "admin_sec_test", RoleCode.ADMIN, employee2Id);
        managerToken = jwtService.generateToken(999L, "manager_sec_test", RoleCode.MANAGER, null);
    }

    @Test
    @DisplayName("Требование 2: Доступ к закрытым ресурсам без Authorization токена возвращает 401 Unauthorized")
    void shouldReturn401WhenNoTokenProvided() throws Exception {
        mockMvc.perform(get("/api/employees/" + employee1Id))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    @DisplayName("Требование 2: Доступ с невалидным или поврежденным токеном возвращает 401 Unauthorized")
    void shouldReturn401WhenInvalidTokenProvided() throws Exception {
        mockMvc.perform(get("/api/employees/" + employee1Id)
                        .header("Authorization", "Bearer invalid.malformed.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("Требование 1: Аутентификация через /api/auth/login возвращает валидный JWT токен")
    void shouldAuthenticateAndReturnJwt() throws Exception {
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("pekarev_sec_test", "1234");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.login").value("pekarev_sec_test"))
                .andExpect(jsonPath("$.role").value("EMPLOYEE"))
                .andExpect(jsonPath("$.employeeId").value(employee1Id));
    }

    @Test
    @DisplayName("Требование 7: Пользователей могут создавать ТОЛЬКО супервайзеры (ADMIN) - EMPLOYEE получает 403 Forbidden")
    void shouldForbidEmployeeFromCreatingUser() throws Exception {
        UserDto.Request newReq = UserDto.Request.builder()
                .login("unauthorized_user")
                .password("1234")
                .roleId((short) 3)
                .build();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"));
    }

    @Test
    @DisplayName("Требование 7: Пользователей могут создавать ТОЛЬКО супервайзеры (ADMIN) - MANAGER получает 403 Forbidden")
    void shouldForbidManagerFromCreatingUser() throws Exception {
        UserDto.Request newReq = UserDto.Request.builder()
                .login("unauthorized_user_2")
                .password("1234")
                .roleId((short) 3)
                .build();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Требование 7: Супервайзер (ADMIN) успешно создает нового пользователя в системе")
    void shouldAllowAdminToCreateUser() throws Exception {
        UserDto.Request newReq = UserDto.Request.builder()
                .login("created_by_admin")
                .password("1234")
                .roleId((short) 3)
                .build();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.login").value("created_by_admin"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    @DisplayName("Требование 4: Изоляция данных - EMPLOYEE может получить доступ ТОЛЬКО к собственной карточке")
    void shouldEnforceEmployeeSelfOnlyAccessOnEmployeeResource() throws Exception {
        // Доступ к собственной карточке -> 200 OK
        mockMvc.perform(get("/api/employees/" + employee1Id)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(employee1Id))
                .andExpect(jsonPath("$.name").value("Пекарёв Пекарь"));

        // Попытка доступа к чужой карточке -> 403 Forbidden
        mockMvc.perform(get("/api/employees/" + employee2Id)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Требование 4: Изоляция данных - EMPLOYEE может получить доступ ТОЛЬКО к собственному профилю User")
    void shouldEnforceEmployeeSelfOnlyAccessOnUserResource() throws Exception {
        // Доступ к собственному профилю по ID -> 200 OK
        mockMvc.perform(get("/api/users/" + userEmpId)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userEmpId))
                .andExpect(jsonPath("$.login").value("pekarev_sec_test"));

        // Доступ к чужому профилю по ID -> 403 Forbidden
        mockMvc.perform(get("/api/users/" + userAdminId)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Требование 4: Администратор (ADMIN) имеет доступ к карточкам всех сотрудников и пользователей")
    void shouldAllowAdminAccessToAllEmployeesAndUsers() throws Exception {
        mockMvc.perform(get("/api/employees/" + employee1Id)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/employees/" + employee2Id)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/users/" + userEmpId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Требования 5 и 6: Модели пользователей никогда не возвращают пароль или хэш в API")
    void shouldNeverExposePasswordInResponses() throws Exception {
        mockMvc.perform(get("/api/users/" + userEmpId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.login").value("pekarev_sec_test"));
    }

    @Test
    @DisplayName("Эндпоинт /api/auth/me возвращает информацию о текущем авторизованном пользователе")
    void shouldReturnMeInfo() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.login").value("pekarev_sec_test"))
                .andExpect(jsonPath("$.roleCode").value("EMPLOYEE"))
                .andExpect(jsonPath("$.employeeId").value(employee1Id))
                .andExpect(jsonPath("$.password").doesNotExist());
    }
}
