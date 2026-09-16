package junsik.reservation.support;

import java.util.ArrayList;
import java.util.List;

import org.hibernate.resource.jdbc.spi.StatementInspector;

public final class SqlCaptureStatementInspector implements StatementInspector {

	private static final ThreadLocal<List<String>> STATEMENTS = ThreadLocal.withInitial(ArrayList::new);

	@Override
	public String inspect(String sql) {
		STATEMENTS.get().add(normalize(sql));
		return sql;
	}

	public static void clear() {
		STATEMENTS.get().clear();
	}

	public static List<String> snapshot() {
		return List.copyOf(STATEMENTS.get());
	}

	private String normalize(String sql) {
		return sql.replaceAll("\\s+", " ").trim();
	}
}
