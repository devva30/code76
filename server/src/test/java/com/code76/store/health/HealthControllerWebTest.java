package com.code76.store.health;

import com.code76.store.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HealthController.class)
@Import(SecurityConfig.class)
class HealthControllerWebTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    JdbcTemplate jdbc;

    @Test
    void upWhenDatabaseAnswers() throws Exception {
        when(jdbc.queryForObject("select 1", Integer.class)).thenReturn(1);

        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("code76-server"));
    }

    @Test
    void returns503WhenDatabaseIsUnreachable() throws Exception {
        when(jdbc.queryForObject("select 1", Integer.class)).thenThrow(new DataAccessResourceFailureException("connection refused"));

        mvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.database").value("DOWN"));
    }
}
