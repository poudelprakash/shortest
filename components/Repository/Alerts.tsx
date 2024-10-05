import { AlertCircle } from 'lucide-react';

interface AlertsProps {
  alerts: string[];
}

const Alerts: React.FC<AlertsProps> = ({ alerts }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-md mb-4">
      <div className="flex items-center space-x-2">
        <AlertCircle className="text-yellow-500" />
        <div className="text-yellow-800 font-semibold">Alerts</div>
      </div>
      <ul className="list-disc list-inside mt-2">
        {alerts.map((alert, index) => (
          <li key={index} className="text-yellow-700">
            {alert}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Alerts;