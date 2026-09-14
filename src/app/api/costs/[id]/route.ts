import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, description, costType, amount, percentage, active } = body;

    const existingCost = await prisma.cost.findUnique({
      where: { id },
    });

    if (!existingCost) {
      return NextResponse.json({ error: 'Cost not found' }, { status: 404 });
    }

    const updateData: {
      name?: string;
      description?: string | null;
      costType?: string;
      amount?: number | null;
      percentage?: number | null;
      active?: boolean;
    } = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: 'Cost name cannot be empty' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    if (costType !== undefined) {
      if (!['fixed_monthly', 'sales_percentage'].includes(costType)) {
        return NextResponse.json({ error: 'Invalid cost type' }, { status: 400 });
      }
      updateData.costType = costType;
    }

    const targetType = costType || existingCost.costType;

    if (targetType === 'fixed_monthly') {
      if (amount !== undefined) {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return NextResponse.json({ error: 'Monthly amount must be greater than 0' }, { status: 400 });
        }
        updateData.amount = parsedAmount;
        updateData.percentage = null;
      }
    } else if (targetType === 'sales_percentage') {
      if (percentage !== undefined) {
        const parsedPercentage = parseFloat(percentage);
        if (isNaN(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
          return NextResponse.json({ error: 'Percentage must be between 0 and 100' }, { status: 400 });
        }
        updateData.percentage = parsedPercentage;
        updateData.amount = null;
      }
    }

    if (active !== undefined) {
      updateData.active = Boolean(active);
    }

    const updatedCost = await prisma.cost.update({
      where: { id },
      data: updateData,
    });

    await prisma.activityLog.create({
      data: {
        action: `Updated Cost "${updatedCost.name}"`,
        details: `Updated parameters for ${updatedCost.costType}`,
        type: 'update',
      },
    });

    return NextResponse.json(updatedCost);
  } catch (error) {
    console.error('API Costs PUT error:', error);
    return NextResponse.json({ error: 'Failed to update cost' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existingCost = await prisma.cost.findUnique({
      where: { id },
    });

    if (!existingCost) {
      return NextResponse.json({ error: 'Cost not found' }, { status: 404 });
    }

    await prisma.cost.delete({
      where: { id },
    });

    await prisma.activityLog.create({
      data: {
        action: `Deleted Cost "${existingCost.name}"`,
        details: `Removed ${existingCost.costType} cost`,
        type: 'delete',
      },
    });

    return NextResponse.json({ success: true, message: 'Cost deleted successfully' });
  } catch (error) {
    console.error('API Costs DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete cost' }, { status: 500 });
  }
}
