package portal.employee.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import portal.dto.BranchDto;
import portal.dto.CompanyDto;
import portal.dto.EmployeeAssignmentDto;
import portal.dto.EmployeeDto;
import portal.dto.EmployeeStatus;
import portal.dto.PositionDto;
import portal.employee.service.BranchService;
import portal.employee.service.CompanyService;
import portal.employee.service.EmployeeService;
import portal.employee.service.PositionService;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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
class EmployeeServiceSpringBootTest {

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private CompanyService companyService;

    @Autowired
    private BranchService branchService;

    @Autowired
    private PositionService positionService;

    private Long companyId;
    private Long branchId;
    private Long positionId;

    @BeforeEach
    void setUp() {
        CompanyDto.Response company = companyService.create(CompanyDto.Request.builder()
                .name("Интеграционная Компания")
                .build());
        companyId = company.getId();

        BranchDto.Response branch = branchService.create(BranchDto.Request.builder()
                .companyId(companyId)
                .name("Центральный офис")
                .address("г. Санкт-Петербург, Невский пр., 1, офис 100")
                .phone("+78121234567")
                .isActive(true)
                .build());
        branchId = branch.getId();

        PositionDto.Response position = positionService.create(PositionDto.Request.builder()
                .title("Ведущий разработчик")
                .build());
        positionId = position.getId();
    }

    @Test
    @DisplayName("Complete lifecycle: create employee, assign to branch, dismiss, and verify")
    void testEmployeeLifecycleIntegration() {
        // 1. Create employee
        EmployeeDto.Request req = EmployeeDto.Request.builder()
                .name("Алексей Разработчик")
                .phone("+79997778899")
                .birthDate(LocalDate.of(2001, 3, 15))
                .hireDate(LocalDate.of(2024, 1, 10))
                .status(EmployeeStatus.ACTIVE)
                .build();

        EmployeeDto.Response created = employeeService.create(req);
        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Алексей Разработчик");
        assertThat(created.getStatus()).isEqualTo(EmployeeStatus.ACTIVE);

        // 2. Assign employee to branch and position
        EmployeeAssignmentDto.Request assignReq = EmployeeAssignmentDto.Request.builder()
                .employeeId(created.getId())
                .branchId(branchId)
                .positionId(positionId)
                .startedAt(LocalDate.of(2024, 1, 10))
                .isPrimary(true)
                .build();

        EmployeeAssignmentDto.Response assignment = employeeService.assignToBranch(assignReq);
        assertThat(assignment.getId()).isNotNull();
        assertThat(assignment.getEmployeeId()).isEqualTo(created.getId());
        assertThat(assignment.getBranchId()).isEqualTo(branchId);
        assertThat(assignment.getPositionTitle()).isEqualTo("Ведущий разработчик");

        // 3. Verify assignments list
        List<EmployeeAssignmentDto.Response> assignments = employeeService.getAssignments(created.getId());
        assertThat(assignments).hasSize(1);

        // 4. Dismiss employee
        EmployeeDto.Response dismissed = employeeService.dismiss(created.getId());
        assertThat(dismissed.getStatus()).isEqualTo(EmployeeStatus.DISMISSED);
        assertThat(dismissed.getDismissalDate()).isEqualTo(LocalDate.now());

        // 5. Rehire employee
        EmployeeDto.Response rehired = employeeService.rehire(created.getId());
        assertThat(rehired.getStatus()).isEqualTo(EmployeeStatus.ACTIVE);
        assertThat(rehired.getDismissalDate()).isNull();
    }
}
