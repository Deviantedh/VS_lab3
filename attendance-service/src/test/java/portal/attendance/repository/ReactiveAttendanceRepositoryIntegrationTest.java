package portal.attendance.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import portal.attendance.entity.ReactiveAttendanceRecord;
import reactor.test.StepVerifier;

import java.io.File;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = portal.attendance.AttendanceServiceApplication.class, properties = {
        "spring.flyway.enabled=false",
        "spring.autoconfigure.exclude=" +
                "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration," +
                "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration," +
                "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration," +
                "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration," +
                "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration," +
                "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration"
})
@ActiveProfiles("test")
@DisabledIf("isDockerNotAvailable")
@Testcontainers(disabledWithoutDocker = true)
class ReactiveAttendanceRepositoryIntegrationTest {

    static boolean isDockerNotAvailable() {
        return !new File(System.getProperty("user.home") + "/.docker/run/docker.sock").exists()
                && !new File("/var/run/docker.sock").exists();
    }

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("test_attendance_db")
            .withUsername("test_user")
            .withPassword("test_secret");

    @DynamicPropertySource
    static void configureR2dbc(DynamicPropertyRegistry registry) {
        if (postgres.isRunning()) {
            registry.add("spring.r2dbc.url", () -> String.format("r2dbc:postgresql://%s:%d/%s",
                    postgres.getHost(),
                    postgres.getFirstMappedPort(),
                    postgres.getDatabaseName()));
            registry.add("spring.r2dbc.username", postgres::getUsername);
            registry.add("spring.r2dbc.password", postgres::getPassword);
        }
    }

    @Autowired
    private ReactiveAttendanceRepository repository;

    @Autowired
    private DatabaseClient databaseClient;

    @BeforeEach
    void initDb() {
        if (postgres.isRunning()) {
            String createTableSql = """
                    CREATE TABLE IF NOT EXISTS attendance_records (
                        id BIGSERIAL PRIMARY KEY,
                        employee_id BIGINT,
                        shift_id BIGINT,
                        planned_start TIMESTAMP WITH TIME ZONE,
                        planned_end TIMESTAMP WITH TIME ZONE,
                        actual_start TIMESTAMP WITH TIME ZONE,
                        actual_end TIMESTAMP WITH TIME ZONE,
                        break_minutes INT,
                        comment TEXT,
                        late_minutes BIGINT,
                        overtime_minutes BIGINT,
                        created_at TIMESTAMP WITH TIME ZONE,
                        updated_at TIMESTAMP WITH TIME ZONE
                    );
                    """;
            databaseClient.sql(createTableSql).then().block();
            databaseClient.sql("DELETE FROM attendance_records;").then().block();
        }
    }

    @Test
    @DisplayName("Verify reactive repository save, findById, and query methods with StepVerifier")
    void testSaveAndQuery() {
        Instant now = Instant.now();
        ReactiveAttendanceRecord record = ReactiveAttendanceRecord.builder()
                .employeeId(42L)
                .shiftId(100L)
                .plannedStart(now)
                .plannedEnd(now.plusSeconds(28800))
                .actualStart(now)
                .comment("R2DBC интеграционный тест")
                .createdAt(now)
                .updatedAt(now)
                .build();

        // 1. Save and verify emission
        StepVerifier.create(repository.save(record))
                .assertNext(saved -> {
                    assertThat(saved.getId()).isNotNull();
                    assertThat(saved.getEmployeeId()).isEqualTo(42L);
                    assertThat(saved.getComment()).isEqualTo("R2DBC интеграционный тест");
                })
                .verifyComplete();

        // 2. Query by employeeId with pagination
        StepVerifier.create(repository.findByEmployeeId(42L, PageRequest.of(0, 10)))
                .assertNext(found -> {
                    assertThat(found.getEmployeeId()).isEqualTo(42L);
                    assertThat(found.getShiftId()).isEqualTo(100L);
                })
                .verifyComplete();

        // 3. Query by shiftId and employeeId
        StepVerifier.create(repository.findByShiftIdAndEmployeeId(100L, 42L))
                .assertNext(found -> {
                    assertThat(found.getShiftId()).isEqualTo(100L);
                    assertThat(found.getEmployeeId()).isEqualTo(42L);
                })
                .verifyComplete();
    }
}
