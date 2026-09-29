import { Text } from "react-native";

import { Card, ScreenFrame } from "@/components/screen-frame";

export default function CuentasScreen() {
  return (
    <ScreenFrame title="Cuentas corrientes">
      <Card>
        <Text className="text-base leading-6 text-ink">Todavía no hay apostadores cargados.</Text>
      </Card>
    </ScreenFrame>
  );
}
