import com.sun.tools.attach.VirtualMachine;
import java.lang.management.ManagementFactory;
import javax.management.ObjectName;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;

// Run in the backend container. No remotely exposed JMX connector or application changes.
public class Observe {
    public static void main(String[] args) throws Exception {
        var pid = Long.parseLong(args[0]);
        var vm = VirtualMachine.attach(Long.toString(pid));
        String address;
        try {
            address = vm.startLocalManagementAgent();
        } finally {
            vm.detach();
        }
        try (var connection = JMXConnectorFactory.connect(new JMXServiceURL(address))) {
            var server = connection.getMBeanServerConnection();
            var memory = ManagementFactory.newPlatformMXBeanProxy(server, ManagementFactory.MEMORY_MXBEAN_NAME,
                java.lang.management.MemoryMXBean.class);
            var threads = ManagementFactory.newPlatformMXBeanProxy(server, ManagementFactory.THREAD_MXBEAN_NAME,
                java.lang.management.ThreadMXBean.class);
            var gc = ManagementFactory.getPlatformMXBeans(server, java.lang.management.GarbageCollectorMXBean.class);
            var pool = new ObjectName("com.zaxxer.hikari:type=Pool (ReservationLoad)");
            System.out.printf(java.util.Locale.ROOT,
                "{\"pid\":%d,\"heapUsedBytes\":%d,\"heapMaxBytes\":%d,\"threads\":%d,\"gcCount\":%d,\"gcTimeMs\":%d,"
                + "\"pool\":{\"active\":%s,\"idle\":%s,\"total\":%s,\"pending\":%s}}%n",
                pid, memory.getHeapMemoryUsage().getUsed(), memory.getHeapMemoryUsage().getMax(),
                threads.getThreadCount(), gc.stream().mapToLong(bean -> Math.max(0, bean.getCollectionCount())).sum(),
                gc.stream().mapToLong(bean -> Math.max(0, bean.getCollectionTime())).sum(),
                server.getAttribute(pool, "ActiveConnections"), server.getAttribute(pool, "IdleConnections"),
                server.getAttribute(pool, "TotalConnections"), server.getAttribute(pool, "ThreadsAwaitingConnection"));
        }
    }
}
