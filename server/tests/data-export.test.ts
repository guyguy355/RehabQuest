import { createApp, createUser, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';

const app = createApp({ summaryModel: null });

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

describe('self-service data export', () => {
  test('a patient gets their account, care team, messages and records; the export is audited', async () => {
    const therapist = await createUser('THERAPIST', { name: 'Dana' });
    const patient = await createUser('PATIENT', { name: 'Maya' });
    await prisma.therapistPatient.create({ data: { therapistId: therapist.id, patientId: patient.id } });
    await prisma.message.create({ data: { senderId: therapist.id, receiverId: patient.id, text: 'Welcome to your plan' } });
    await prisma.weeklyCheckIn.create({ data: { patientId: patient.id, weekStart: new Date('2026-11-15T00:00:00Z'), painTypical: 3, confidence: 4 } });

    const response = await request(app).get('/me/export').set('Authorization', `Bearer ${createAuthToken(patient.id)}`).expect(200);

    assert.match(response.headers['content-disposition'], /attachment; filename="rehabquest-export-\d{4}-\d{2}-\d{2}\.json"/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body.format, 'rehabquest-data-export');
    assert.equal(response.body.account.email, patient.email);
    assert.equal(response.body.account.passwordHash, undefined);
    assert.equal(response.body.careTeam.length, 1);
    assert.equal(response.body.careTeam[0].therapist.name, 'Dana');
    assert.equal(response.body.messages.length, 1);
    assert.equal(response.body.messages[0].text, 'Welcome to your plan');
    assert.equal(response.body.weeklyCheckIns.length, 1);
    assert.deepEqual(response.body.plans, []);

    const events = await prisma.auditEvent.findMany({ where: { action: 'EXPORT_CREATED' } });
    assert.equal(events.length, 1);
    assert.equal(events[0].actorId, patient.id);
    assert.equal(events[0].patientId, patient.id);
  });

  test('a therapist gets only their own account and care links, never patient records', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT');
    await prisma.therapistPatient.create({ data: { therapistId: therapist.id, patientId: patient.id } });
    await prisma.message.create({ data: { senderId: patient.id, receiverId: therapist.id, text: 'My knee hurts' } });

    const response = await request(app).get('/me/export').set('Authorization', `Bearer ${createAuthToken(therapist.id)}`).expect(200);

    assert.equal(response.body.account.role, 'THERAPIST');
    assert.equal(response.body.careLinks.length, 1);
    assert.equal(response.body.messages, undefined);
    assert.equal(response.body.exerciseRecords, undefined);
  });

  test('requires a signed-in user', async () => {
    await request(app).get('/me/export').expect(401);
  });
});
