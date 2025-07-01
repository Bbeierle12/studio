'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ControlPanelProps {
  onTriggerCatastrophe?: () => void
  onAlterEnvironment?: () => void
  onSeedLife?: () => void
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onTriggerCatastrophe,
  onAlterEnvironment,
  onSeedLife,
}) => {
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-center">Interventions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" variant="destructive" onClick={onTriggerCatastrophe}>
          Trigger Catastrophe
        </Button>
        <Button className="w-full" variant="outline" onClick={onAlterEnvironment}>
          Alter Environment
        </Button>
        <Button className="w-full" variant="secondary" onClick={onSeedLife}>
          Seed Life
        </Button>
      </CardContent>
    </Card>
  )
}

export default ControlPanel
