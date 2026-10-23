package portal.employee.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import portal.dto.EmployeeDto;
import portal.dto.EmployeeStatus;
import portal.employee.service.EmployeeService;

import java.io.File;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = portal.employee.EmployeeServiceApplication.class)
@ActiveProfiles("test")
@DisabledIf("isDockerNotAvailable")
@Testcontainers(disabledWithoutDocker = true)
class EmployeeServicePostgresIntegrationTest {

    static boolean isDockerNotAvailable() {
        return !new File(System.getProperty("user.home") + "/.docker/run/docker.sock").exists()
                && !new File("/var/run/docker.sock").exists();
    }

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("test_portal_db")
            .withUsername("test_user")
            .withPassword("test_secret");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        if (postgres.isRunning()) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
            registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
            registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        }
    }

    @Autowired
    private EmployeeService employeeService;

    @Test
    @DisplayName("Test employee creation and retrieval against Testcontainers PostgreSQL")
    void testCreateEmployeeInPostgresContainer() {
        EmployeeDto.Request request = EmployeeDto.Request.builder()
                .name("Тест Контейнер")
                .phone("+79990001122")
                .birthDate(LocalDate.of(1992, 4, 12))
                .hireDate(LocalDate.of(2025, 5, 1))
                .status(EmployeeStatus.ACTIVE)
                .build();

        EmployeeDto.Response created = employeeService.create(request);
        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Тест Контейнер");

        EmployeeDto.Response fetched = employeeService.getById(created.getId());
        assertThat(fetched.getId()).isEqualTo(created.getId());
        assertThat(fetched.getPhone()).isEqualTo("+79990001122");
    }
}
